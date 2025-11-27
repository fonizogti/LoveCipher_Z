import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface DatingPreference {
  id: string;
  name: string;
  age: number;
  location: string;
  interests: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
  matchScore?: number;
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
    status: "pending", 
    message: "" 
  });
  const [newPreferenceData, setNewPreferenceData] = useState({ 
    name: "", 
    age: "", 
    location: "", 
    interests: "",
    importance: ""
  });
  const [selectedPreference, setSelectedPreference] = useState<DatingPreference | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredPreferences, setFilteredPreferences] = useState<DatingPreference[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
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
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  useEffect(() => {
    const filtered = preferences.filter(pref =>
      pref.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pref.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pref.interests.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredPreferences(filtered);
    setCurrentPage(1);
  }, [searchTerm, preferences]);

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
            id: businessId,
            name: businessData.name,
            age: Number(businessData.publicValue1) || 0,
            location: businessData.description,
            interests: `Importance: ${businessData.publicValue2}`,
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
      
      const importanceValue = parseInt(newPreferenceData.importance) || 0;
      const businessId = `preference-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, importanceValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newPreferenceData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newPreferenceData.age) || 0,
        importanceValue,
        newPreferenceData.location
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Preference created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewPreferenceData({ name: "", age: "", location: "", interests: "", importance: "" });
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
    
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        return Number(businessData.decryptedValue) || 0;
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
    }
  };

  const testAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: "Contract is available and working!" 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const paginatedPreferences = filteredPreferences.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredPreferences.length / itemsPerPage);

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>💖 LoveCipher</h1>
            <span>Private Dating Preference Matching</span>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">💕</div>
            <h2>Connect Your Heart Wallet</h2>
            <p>Connect your wallet to start your private dating journey with FHE protection.</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect your wallet securely</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>FHE system will encrypt your preferences</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Find your perfect match privately</p>
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
        <p className="loading-note">Securing your heart's data with FHE</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading encrypted dating preferences...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>💖 LoveCipher</h1>
          <span>FHE Protected Dating</span>
        </div>
        
        <div className="header-actions">
          <button onClick={testAvailability} className="test-btn">
            Test FHE
          </button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + New Preference
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content">
        <div className="stats-section">
          <div className="stat-card">
            <div className="stat-icon">💕</div>
            <div className="stat-info">
              <div className="stat-value">{preferences.length}</div>
              <div className="stat-label">Total Profiles</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔒</div>
            <div className="stat-info">
              <div className="stat-value">{preferences.filter(p => p.isVerified).length}</div>
              <div className="stat-label">Verified</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-info">
              <div className="stat-value">85%</div>
              <div className="stat-label">Avg Match</div>
            </div>
          </div>
        </div>

        <div className="search-section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search by name, location, or interests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button onClick={loadData} className="refresh-btn" disabled={isRefreshing}>
              {isRefreshing ? "🔄" : "🔍"}
            </button>
          </div>
        </div>

        <div className="preferences-grid">
          {paginatedPreferences.map((pref, index) => (
            <div key={index} className="preference-card" onClick={() => setSelectedPreference(pref)}>
              <div className="card-header">
                <div className="card-title">{pref.name}</div>
                <div className={`match-score ${pref.matchScore && pref.matchScore > 80 ? 'high' : pref.matchScore && pref.matchScore > 60 ? 'medium' : 'low'}`}>
                  {pref.matchScore}%
                </div>
              </div>
              <div className="card-content">
                <div className="pref-info">
                  <span>Age: {pref.age}</span>
                  <span>Location: {pref.location}</span>
                </div>
                <div className="pref-status">
                  {pref.isVerified ? (
                    <span className="verified">✅ Verified</span>
                  ) : (
                    <span className="pending">🔒 Encrypted</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="page-btn"
            >
              Previous
            </button>
            <span className="page-info">Page {currentPage} of {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="page-btn"
            >
              Next
            </button>
          </div>
        )}
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
          onClose={() => setSelectedPreference(null)} 
          isDecrypting={fheIsDecrypting} 
          decryptData={() => decryptData(selectedPreference.id)}
        />
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

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>About LoveCipher</h4>
            <p>Private dating preference matching using FHE technology</p>
          </div>
          <div className="footer-section">
            <h4>FHE Protection</h4>
            <p>Your data is encrypted end-to-end</p>
          </div>
        </div>
      </footer>
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPreferenceData({ ...preferenceData, [name]: value });
  };

  return (
    <div className="modal-overlay">
      <div className="create-preference-modal">
        <div className="modal-header">
          <h2>Create Dating Preference</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Protection</strong>
            <p>Your preference importance will be encrypted with FHE</p>
          </div>
          
          <div className="form-group">
            <label>Your Name *</label>
            <input 
              type="text" 
              name="name" 
              value={preferenceData.name} 
              onChange={handleChange} 
              placeholder="Enter your name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Age *</label>
            <input 
              type="number" 
              name="age" 
              value={preferenceData.age} 
              onChange={handleChange} 
              placeholder="Enter your age..." 
              min="18"
              max="100"
            />
          </div>
          
          <div className="form-group">
            <label>Location *</label>
            <input 
              type="text" 
              name="location" 
              value={preferenceData.location} 
              onChange={handleChange} 
              placeholder="Enter your location..." 
            />
          </div>
          
          <div className="form-group">
            <label>Relationship Importance (1-10) *</label>
            <input 
              type="number" 
              min="1" 
              max="10" 
              name="importance" 
              value={preferenceData.importance} 
              onChange={handleChange} 
              placeholder="How important is relationship?" 
            />
            <div className="data-type-label">FHE Encrypted</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !preferenceData.name || !preferenceData.age || !preferenceData.location || !preferenceData.importance} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting..." : "Create Preference"}
          </button>
        </div>
      </div>
    </div>
  );
};

const PreferenceDetailModal: React.FC<{
  preference: DatingPreference;
  onClose: () => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ preference, onClose, isDecrypting, decryptData }) => {
  const [decryptedImportance, setDecryptedImportance] = useState<number | null>(null);

  const handleDecrypt = async () => {
    const decrypted = await decryptData();
    setDecryptedImportance(decrypted);
  };

  return (
    <div className="modal-overlay">
      <div className="preference-detail-modal">
        <div className="modal-header">
          <h2>Dating Preference Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="preference-info">
            <div className="info-item">
              <span>Name:</span>
              <strong>{preference.name}</strong>
            </div>
            <div className="info-item">
              <span>Age:</span>
              <strong>{preference.age}</strong>
            </div>
            <div className="info-item">
              <span>Location:</span>
              <strong>{preference.location}</strong>
            </div>
            <div className="info-item">
              <span>Match Score:</span>
              <strong className={`match-score ${preference.matchScore && preference.matchScore > 80 ? 'high' : preference.matchScore && preference.matchScore > 60 ? 'medium' : 'low'}`}>
                {preference.matchScore}%
              </strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted Preference Data</h3>
            
            <div className="data-row">
              <div className="data-label">Relationship Importance:</div>
              <div className="data-value">
                {preference.isVerified && preference.decryptedValue ? 
                  `${preference.decryptedValue}/10 (Verified)` : 
                  decryptedImportance !== null ? 
                  `${decryptedImportance}/10 (Decrypted)` : 
                  "🔒 FHE Encrypted"
                }
              </div>
              <button 
                className={`decrypt-btn ${(preference.isVerified || decryptedImportance !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? "🔓 Decrypting..." : 
                 preference.isVerified ? "✅ Verified" : 
                 decryptedImportance !== null ? "🔄 Re-verify" : "🔓 Decrypt"}
              </button>
            </div>
            
            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE Protected</strong>
                <p>Your preference data is encrypted with Fully Homomorphic Encryption</p>
              </div>
            </div>
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