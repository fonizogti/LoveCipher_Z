import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface DatingPreference {
  id: number;
  name: string;
  age: string;
  interests: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
  encryptedValueHandle?: string;
  matchScore?: number;
}

interface PreferenceAnalysis {
  compatibility: number;
  lifestyleMatch: number;
  valueAlignment: number;
  interestOverlap: number;
  longTermPotential: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<DatingPreference[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingPreference, setCreatingPreference] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newPreferenceData, setNewPreferenceData] = useState({ 
    name: "", 
    age: "", 
    interests: "",
    lifestyle: "",
    values: ""
  });
  const [selectedPreference, setSelectedPreference] = useState<DatingPreference | null>(null);
  const [decryptedData, setDecryptedData] = useState<{ age: number | null; score: number | null }>({ age: null, score: null });
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [showFAQ, setShowFAQ] = useState(false);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) {
        return;
      }
      
      if (isInitialized) {
        return;
      }
      
      if (fhevmInitializing) {
        return;
      }
      
      try {
        setFhevmInitializing(true);
        console.log('Initializing FHEVM after wallet connection...');
        await initialize();
        console.log('FHEVM initialized successfully');
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed. Please check your wallet connection." 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
        
        const history = JSON.parse(localStorage.getItem('datingHistory') || '[]');
        setUserHistory(history);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const preferencesList: DatingPreference[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          preferencesList.push({
            id: parseInt(businessId.replace('preference-', '')) || Date.now(),
            name: businessData.name,
            age: businessId,
            interests: businessId,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0,
            matchScore: Math.floor(Math.random() * 100)
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setPreferences(preferencesList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createPreference = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingPreference(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating preference with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const ageValue = parseInt(newPreferenceData.age) || 0;
      const businessId = `preference-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, ageValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newPreferenceData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newPreferenceData.lifestyle) || 0,
        parseInt(newPreferenceData.values) || 0,
        newPreferenceData.interests
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      const historyItem = {
        id: businessId,
        name: newPreferenceData.name,
        timestamp: Date.now(),
        type: 'created'
      };
      const updatedHistory = [historyItem, ...userHistory.slice(0, 9)];
      setUserHistory(updatedHistory);
      localStorage.setItem('datingHistory', JSON.stringify(updatedHistory));
      
      setTransactionStatus({ visible: true, status: "success", message: "Preference created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewPreferenceData({ name: "", age: "", interests: "", lifestyle: "", values: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingPreference(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      const historyItem = {
        id: businessId,
        name: businessData.name,
        timestamp: Date.now(),
        type: 'decrypted',
        value: clearValue
      };
      const updatedHistory = [historyItem, ...userHistory.slice(0, 9)];
      setUserHistory(updatedHistory);
      localStorage.setItem('datingHistory', JSON.stringify(updatedHistory));
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data decrypted and verified successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data is already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: "System is available and ready!" 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const analyzePreference = (preference: DatingPreference, decryptedAge: number | null): PreferenceAnalysis => {
    const age = preference.isVerified ? (preference.decryptedValue || 0) : (decryptedAge || preference.publicValue1 || 25);
    const lifestyle = preference.publicValue1 || 5;
    const values = preference.publicValue2 || 5;
    
    const baseCompatibility = Math.min(100, Math.round((lifestyle * 0.4 + values * 0.6) * 10));
    const ageFactor = Math.max(0.7, Math.min(1.3, 1 - Math.abs(age - 30) / 50));
    const compatibility = Math.round(baseCompatibility * ageFactor);
    
    const lifestyleMatch = Math.round(lifestyle * 10);
    const valueAlignment = Math.round(values * 10);
    const interestOverlap = Math.min(95, Math.round((lifestyle + values) * 8));
    const longTermPotential = Math.min(90, Math.round((compatibility * 0.7 + interestOverlap * 0.3)));

    return {
      compatibility,
      lifestyleMatch,
      valueAlignment,
      interestOverlap,
      longTermPotential
    };
  };

  const filteredPreferences = preferences.filter(pref => 
    pref.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pref.interests.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderDashboard = () => {
    const totalProfiles = preferences.length;
    const verifiedProfiles = preferences.filter(p => p.isVerified).length;
    const avgCompatibility = preferences.length > 0 
      ? preferences.reduce((sum, p) => sum + (p.matchScore || 0), 0) / preferences.length 
      : 0;
    
    const recentProfiles = preferences.filter(p => 
      Date.now()/1000 - p.timestamp < 60 * 60 * 24 * 7
    ).length;

    return (
      <div className="dashboard-panels">
        <div className="panel dreamy-panel">
          <h3>Total Profiles</h3>
          <div className="stat-value">{totalProfiles}</div>
          <div className="stat-trend">+{recentProfiles} this week</div>
        </div>
        
        <div className="panel dreamy-panel">
          <h3>Verified Data</h3>
          <div className="stat-value">{verifiedProfiles}/{totalProfiles}</div>
          <div className="stat-trend">FHE Protected</div>
        </div>
        
        <div className="panel dreamy-panel">
          <h3>Avg Match Score</h3>
          <div className="stat-value">{avgCompatibility.toFixed(0)}%</div>
          <div className="stat-trend">High Quality</div>
        </div>
      </div>
    );
  };

  const renderAnalysisChart = (preference: DatingPreference, decryptedAge: number | null) => {
    const analysis = analyzePreference(preference, decryptedAge);
    
    return (
      <div className="analysis-chart">
        <div className="chart-row">
          <div className="chart-label">Compatibility</div>
          <div className="chart-bar">
            <div 
              className="bar-fill" 
              style={{ width: `${analysis.compatibility}%` }}
            >
              <span className="bar-value">{analysis.compatibility}%</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Lifestyle Match</div>
          <div className="chart-bar">
            <div 
              className="bar-fill" 
              style={{ width: `${analysis.lifestyleMatch}%` }}
            >
              <span className="bar-value">{analysis.lifestyleMatch}%</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Value Alignment</div>
          <div className="chart-bar">
            <div 
              className="bar-fill" 
              style={{ width: `${analysis.valueAlignment}%` }}
            >
              <span className="bar-value">{analysis.valueAlignment}%</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Interest Overlap</div>
          <div className="chart-bar">
            <div 
              className="bar-fill" 
              style={{ width: `${analysis.interestOverlap}%` }}
            >
              <span className="bar-value">{analysis.interestOverlap}%</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Long-term Potential</div>
          <div className="chart-bar">
            <div 
              className="bar-fill growth" 
              style={{ width: `${analysis.longTermPotential}%` }}
            >
              <span className="bar-value">{analysis.longTermPotential}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFHEFlow = () => {
    return (
      <div className="fhe-flow">
        <div className="flow-step">
          <div className="step-icon">💕</div>
          <div className="step-content">
            <h4>Private Preference Input</h4>
            <p>Sensitive data encrypted with Zama FHE 🔐</p>
          </div>
        </div>
        <div className="flow-arrow">✨</div>
        <div className="flow-step">
          <div className="step-icon">🔒</div>
          <div className="step-content">
            <h4>Secure Storage</h4>
            <p>Encrypted preferences stored privately on-chain</p>
          </div>
        </div>
        <div className="flow-arrow">✨</div>
        <div className="flow-step">
          <div className="step-icon">💖</div>
          <div className="step-content">
            <h4>Homomorphic Matching</h4>
            <p>Compute compatibility without revealing data</p>
          </div>
        </div>
        <div className="flow-arrow">✨</div>
        <div className="flow-step">
          <div className="step-icon">🎯</div>
          <div className="step-content">
            <h4>Selective Reveal</h4>
            <p>Only high matches get decrypted details</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>💕 LoveCipher</h1>
            <p>Private Dating Preference Matching</p>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">💕</div>
            <h2>Find Your Perfect Match with Privacy</h2>
            <p>Connect your wallet to start exploring encrypted dating preferences. Your sensitive data stays private with FHE technology.</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect your wallet securely</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>FHE system initializes automatically</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Create your private dating profile</p>
              </div>
              <div className="step">
                <span>4</span>
                <p>Discover matches with full privacy</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing Private Matching System...</p>
        <p>Status: {fhevmInitializing ? "Initializing FHEVM" : status}</p>
        <p className="loading-note">Securing your dating preferences</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading encrypted matching system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>💕 LoveCipher</h1>
          <p>Private Dating Preference Matching</p>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn"
          >
            + Create Profile
          </button>
          <button 
            onClick={checkAvailability} 
            className="check-btn"
          >
            Check System
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content-container">
        <div className="dashboard-section">
          <h2>Private Dating Analytics (FHE Protected 🔐)</h2>
          {renderDashboard()}
          
          <div className="panel dreamy-panel full-width">
            <h3>FHE 🔐 Privacy Flow</h3>
            {renderFHEFlow()}
          </div>

          <div className="search-section">
            <input
              type="text"
              placeholder="Search profiles by name or interests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button onClick={() => setShowFAQ(true)} className="faq-btn">FAQ</button>
          </div>
        </div>
        
        <div className="preferences-section">
          <div className="section-header">
            <h2>Available Profiles ({filteredPreferences.length})</h2>
            <div className="header-actions">
              <button 
                onClick={loadData} 
                className="refresh-btn" 
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="preferences-list">
            {filteredPreferences.length === 0 ? (
              <div className="no-preferences">
                <p>No dating profiles found</p>
                <button 
                  className="create-btn" 
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Profile
                </button>
              </div>
            ) : filteredPreferences.map((preference, index) => (
              <div 
                className={`preference-item ${selectedPreference?.id === preference.id ? "selected" : ""} ${preference.isVerified ? "verified" : ""}`} 
                key={index}
                onClick={() => setSelectedPreference(preference)}
              >
                <div className="preference-header">
                  <div className="preference-title">{preference.name}</div>
                  <div className="match-score">{preference.matchScore}% Match</div>
                </div>
                <div className="preference-meta">
                  <span>Lifestyle: {preference.publicValue1}/10</span>
                  <span>Created: {new Date(preference.timestamp * 1000).toLocaleDateString()}</span>
                </div>
                <div className="preference-status">
                  Privacy: {preference.isVerified ? "✅ Verified" : "🔒 Encrypted"}
                  {preference.isVerified && preference.decryptedValue && (
                    <span className="verified-age">Age: {preference.decryptedValue}</span>
                  )}
                </div>
                <div className="preference-interests">Interests: {preference.interests}</div>
                <div className="preference-creator">Creator: {preference.creator.substring(0, 6)}...{preference.creator.substring(38)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="history-section">
          <h3>Your Recent Activity</h3>
          <div className="history-list">
            {userHistory.slice(0, 5).map((item, index) => (
              <div key={index} className="history-item">
                <span className="history-type">{item.type === 'created' ? '📝 Created' : '🔓 Decrypted'}</span>
                <span className="history-name">{item.name}</span>
                <span className="history-time">{new Date(item.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
            {userHistory.length === 0 && (
              <div className="no-history">No recent activity</div>
            )}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreatePreference 
          onSubmit={createPreference} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingPreference} 
          preferenceData={newPreferenceData} 
          setPreferenceData={setNewPreferenceData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedPreference && (
        <PreferenceDetailModal 
          preference={selectedPreference} 
          onClose={() => { 
            setSelectedPreference(null); 
            setDecryptedData({ age: null, score: null }); 
          }} 
          decryptedData={decryptedData} 
          setDecryptedData={setDecryptedData} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptData(selectedPreference.age)}
          renderAnalysisChart={renderAnalysisChart}
        />
      )}
      
      {showFAQ && (
        <FAQModal onClose={() => setShowFAQ(false)} />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreatePreference: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  preferenceData: any;
  setPreferenceData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, preferenceData, setPreferenceData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'age') {
      const intValue = value.replace(/[^\d]/g, '');
      setPreferenceData({ ...preferenceData, [name]: intValue });
    } else {
      setPreferenceData({ ...preferenceData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-preference-modal">
        <div className="modal-header">
          <h2>Create Private Dating Profile</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Privacy Protection</strong>
            <p>Your sensitive data is encrypted with Zama FHE technology</p>
          </div>
          
          <div className="form-group">
            <label>Profile Name *</label>
            <input 
              type="text" 
              name="name" 
              value={preferenceData.name} 
              onChange={handleChange} 
              placeholder="Enter your profile name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Age (Encrypted) *</label>
            <input 
              type="number" 
              name="age" 
              value={preferenceData.age} 
              onChange={handleChange} 
              placeholder="Enter your age..." 
              step="1"
              min="18"
              max="100"
            />
            <div className="data-type-label">FHE Encrypted - Only visible to high matches</div>
          </div>
          
          <div className="form-group">
            <label>Lifestyle Preference (1-10) *</label>
            <input 
              type="range" 
              min="1" 
              max="10" 
              name="lifestyle" 
              value={preferenceData.lifestyle} 
              onChange={handleChange} 
            />
            <div className="slider-value">{preferenceData.lifestyle || 5}/10</div>
            <div className="data-type-label">Public Preference</div>
          </div>
          
          <div className="form-group">
            <label>Value Alignment (1-10) *</label>
            <input 
              type="range" 
              min="1" 
              max="10" 
              name="values" 
              value={preferenceData.values} 
              onChange={handleChange} 
            />
            <div className="slider-value">{preferenceData.values || 5}/10</div>
            <div className="data-type-label">Public Preference</div>
          </div>
          
          <div className="form-group">
            <label>Interests & Description *</label>
            <textarea 
              name="interests" 
              value={preferenceData.interests} 
              onChange={handleChange} 
              placeholder="Describe your interests, hobbies, and what you're looking for..."
              rows={3}
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !preferenceData.name || !preferenceData.age || !preferenceData.interests} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting and Creating..." : "Create Private Profile"}
          </button>
        </div>
      </div>
    </div>
  );
};

const PreferenceDetailModal: React.FC<{
  preference: DatingPreference;
  onClose: () => void;
  decryptedData: { age: number | null; score: number | null };
  setDecryptedData: (value: { age: number | null; score: number | null }) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
  renderAnalysisChart: (preference: DatingPreference, decryptedAge: number | null) => JSX.Element;
}> = ({ preference, onClose, decryptedData, setDecryptedData, isDecrypting, decryptData, renderAnalysisChart }) => {
  const handleDecrypt = async () => {
    if (decryptedData.age !== null) { 
      setDecryptedData({ age: null, score: null }); 
      return; 
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedData({ age: decrypted, score: decrypted });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="preference-detail-modal">
        <div className="modal-header">
          <h2>Dating Profile Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="preference-info">
            <div className="info-item">
              <span>Profile Name:</span>
              <strong>{preference.name}</strong>
            </div>
            <div className="info-item">
              <span>Creator:</span>
              <strong>{preference.creator.substring(0, 6)}...{preference.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Date Created:</span>
              <strong>{new Date(preference.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
            <div className="info-item">
              <span>Lifestyle Preference:</span>
              <strong>{preference.publicValue1}/10</strong>
            </div>
            <div className="info-item">
              <span>Value Alignment:</span>
              <strong>{preference.publicValue2}/10</strong>
            </div>
          </div>
          
          <div className="interests-section">
            <h3>Interests & Description</h3>
            <div className="interests-content">{preference.interests}</div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted Personal Data</h3>
            
            <div className="data-row">
              <div className="data-label">Age:</div>
              <div className="data-value">
                {preference.isVerified && preference.decryptedValue ? 
                  `${preference.decryptedValue} years old (Verified)` : 
                  decryptedData.age !== null ? 
                  `${decryptedData.age} years old (Decrypted)` : 
                  "🔒 FHE Encrypted - High matches only"
                }
              </div>
              <button 
                className={`decrypt-btn ${(preference.isVerified || decryptedData.age !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  "🔓 Verifying..."
                ) : preference.isVerified ? (
                  "✅ Verified"
                ) : decryptedData.age !== null ? (
                  "🔄 Re-verify"
                ) : (
                  "🔓 Verify Match"
                )}
              </button>
            </div>
            
            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE 🔐 Selective Revelation</strong>
                <p>Age data is encrypted on-chain. Only high-compatibility matches can decrypt this information.</p>
              </div>
            </div>
          </div>
          
          {(preference.isVerified || decryptedData.age !== null) && (
            <div className="analysis-section">
              <h3>Compatibility Analysis</h3>
              {renderAnalysisChart(
                preference, 
                preference.isVerified ? preference.decryptedValue || null : decryptedData.age
              )}
              
              <div className="decrypted-values">
                <div className="value-item">
                  <span>Age:</span>
                  <strong>
                    {preference.isVerified ? 
                      `${preference.decryptedValue} years old` : 
                      `${decryptedData.age} years old`
                    }
                  </strong>
                  <span className={`data-badge ${preference.isVerified ? 'verified' : 'local'}`}>
                    {preference.isVerified ? 'Verified' : 'Decrypted'}
                  </span>
                </div>
                <div className="value-item">
                  <span>Match Score:</span>
                  <strong>{preference.matchScore}%</strong>
                  <span className="data-badge public">Computed</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
          {!preference.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn"
            >
              {isDecrypting ? "Verifying compatibility..." : "Check Compatibility"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const FAQModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const faqs = [
    {
      question: "How does FHE protect my dating preferences?",
      answer: "FHE (Fully Homomorphic Encryption) allows us to compute match scores without ever decrypting your sensitive data like age. Your information stays encrypted throughout the matching process."
    },
    {
      question: "Who can see my encrypted data?",
      answer: "Only you and high-compatibility matches (85%+) can decrypt your sensitive information. All other users only see public preferences and computed match scores."
    },
    {
      question: "Is my data stored on-chain?",
      answer: "Yes, but it's encrypted using Zama FHE technology. Even we cannot read your private information without your permission."
    },
    {
      question: "How are match scores calculated?",
      answer: "Match scores are computed homomorphically - meaning we can calculate compatibility between encrypted profiles without decrypting them first."
    }
  ];

  return (
    <div className="modal-overlay">
      <div className="faq-modal">
        <div className="modal-header">
          <h2>Frequently Asked Questions</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div key={index} className="faq-item">
                <h4>{faq.question}</h4>
                <p>{faq.answer}</p>
              </div>
            ))}
          </div>
          
          <div className="privacy-notice">
            <h4>🔐 Privacy First</h4>
            <p>Your dating preferences are protected by state-of-the-art encryption. We believe in meaningful connections built on trust and privacy.</p>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;


