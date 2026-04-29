import { useEffect, useState, useRef } from "react";

function App() {
  const [user, setUser] = useState(null);
  const [usernameContext, setUsernameContext] = useState("");
  const [displayNameContext, setDisplayNameContext] = useState("");
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);

  const [friends, setFriends] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [isNearBottom, setIsNearBottom] = useState(true);
  const messagesRef = useRef(null);
  const bottomRef = useRef(null);
  const activeConvoRef = useRef(null);

  useEffect(() => {
    activeConvoRef.current = activeConversation;
  }, [activeConversation]);

  // Modals state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupSelectedFriends, setGroupSelectedFriends] = useState([]);
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSelectedFriend, setInviteSelectedFriend] = useState("");
  
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [renameConvoId, setRenameConvoId] = useState(null);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);

  // UI state
  const [expandedFriends, setExpandedFriends] = useState({});

  const API_URL = "http://localhost:8000";

  // LOGIN / SIGNUP
  const handleAuth = async () => {
    const endpoint = isLoginMode ? "/api/login/" : "/api/signup/";
    const body = isLoginMode ? { username, password } : { username, password, display_name: displayName };
    
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user_id);
      setUsernameContext(data.username);
      setDisplayNameContext(data.display_name || data.username);
    } else {
      alert(data.error || "Authentication failed");
    }
  };

  const logoutUser = async () => {
    await fetch(`${API_URL}/api/logout/`, { method: "POST" });
    setUser(null);
    setUsernameContext("");
    setDisplayNameContext("");
  };

  const fetchFriends = async () => {
    if (!user) return;
    const res = await fetch(`${API_URL}/api/friends/${user}/`);
    const data = await res.json();
    setFriends(data);
  };

  const fetchPendingRequests = async () => {
    if (!user) return;
    const res = await fetch(`${API_URL}/api/requests/${user}/`);
    const data = await res.json();
    setPendingRequests(data);
  };

  const fetchConversations = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/conversations/?user_id=${user}`);
      const data = await res.json();
      setConversations(data);
      setActiveConversation(prev => {
        if (!prev && data.length > 0) return data[0].id;
        return prev;
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchConversations();
    fetchFriends();
    fetchPendingRequests();
    
    const ws = new WebSocket(`ws://localhost:8000/ws/chat/?user_id=${user}`);
    
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "new_message") {
        fetchConversations();
        if (activeConvoRef.current === parsed.data.conversation) {
          setMessages(prev => [...prev, parsed.data]);
        }
      } else if (parsed.type === "new_request" || parsed.type === "request_accepted") {
        fetchPendingRequests();
        fetchFriends();
        fetchConversations();
      }
    };
    
    return () => ws.close();
  }, [user]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
    }
    const res = await fetch(`${API_URL}/api/search-users/?q=${searchQuery}&user_id=${user}`);
    const data = await res.json();
    setSearchResults(data);
  };

  const sendRequest = async (receiverId) => {
    const res = await fetch(`${API_URL}/api/send-request/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_id: user, receiver_id: receiverId })
    });
    const data = await res.json();
    if (res.ok) {
      alert("Request sent!");
      setSearchQuery("");
      setSearchResults([]);
    } else {
      alert(data.error || "Failed to send request");
    }
  };

  const acceptRequest = async (reqId) => {
    const res = await fetch(`${API_URL}/api/accept-request/${reqId}/`, { method: "POST" });
    if (res.ok) {
      fetchPendingRequests();
      fetchFriends();
      fetchConversations();
    }
  };

  const rejectRequest = async (reqId) => {
    await fetch(`${API_URL}/api/reject-request/${reqId}/`, { method: "POST" });
    fetchPendingRequests();
  };

  // Profile Edit
  const handleEditProfile = async () => {
    if (!profileNameInput.trim()) return;
    const res = await fetch(`${API_URL}/api/edit-profile/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, display_name: profileNameInput })
    });
    const data = await res.json();
    if (res.ok) {
        setDisplayNameContext(data.display_name);
        setShowProfileModal(false);
    }
  };

  // Modals Submit Handlers
  const handleCreateGroupChat = async () => {
    if (groupSelectedFriends.length === 0) return;
    const res = await fetch(`${API_URL}/api/create-conversation/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator_id: user, user_ids: groupSelectedFriends })
    });
    const data = await res.json();
    if (groupNameInput.trim()) {
      await fetch(`${API_URL}/api/rename/${data.id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupNameInput.trim() })
      });
    }
    fetchConversations();
    setActiveConversation(data.id);
    setShowGroupModal(false);
    setGroupNameInput("");
    setGroupSelectedFriends([]);
  };

  const handleInviteUser = async () => {
    if (!inviteSelectedFriend || !activeConversation) return;
    await fetch(`${API_URL}/api/invite/${activeConversation}/`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ user_id: inviteSelectedFriend }),
    });
    setShowInviteModal(false);
    setInviteSelectedFriend("");
    alert("User invited!");
  };

  const handleRenameChat = async () => {
    if (!renameInput.trim() || !renameConvoId) return;
    await fetch(`${API_URL}/api/rename/${renameConvoId}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameInput.trim() }),
    });
    fetchConversations();
    setShowRenameModal(false);
    setRenameInput("");
    setRenameConvoId(null);
  };

  const createDirectChat = async (friendId) => {
    const res = await fetch(`${API_URL}/api/create-conversation/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator_id: user, user_ids: [friendId] })
    });
    const data = await res.json();
    
    // Auto expand the friend's accordion
    setExpandedFriends(prev => ({ ...prev, [friendId]: true }));
    
    fetchConversations();
    setActiveConversation(data.id);
  };

  const deleteConversation = async (id) => {
    await fetch(`${API_URL}/api/delete-conversation/${id}/`, { method: "DELETE" });
    fetchConversations();
    if (activeConversation === id) {
      setActiveConversation(null);
    }
  };

  // GET messages
  const fetchMessages = () => {
    if (!activeConversation) return; 
    fetch(`${API_URL}/api/messages/${activeConversation}/`)
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(err => console.error(err));
  };

  const deleteMessage = async (id) => {
    try {
      await fetch(`${API_URL}/api/delete/${id}/`, { method: "DELETE" });
      fetchMessages();
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (user && activeConversation) {
      fetchMessages();
    }
  }, [user, activeConversation]);

  // auto scroll
  useEffect(() => {
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // SEND message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/send/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage,
          conversation: activeConversation,
          sender: user,
        }),
      });
      if (!res.ok) throw new Error("Failed request");
      setNewMessage("");
      fetchMessages();
    } catch (err) { console.error("SEND ERROR:", err); }
  };

  const toggleFriendExpand = (friendId) => {
      setExpandedFriends(prev => ({ ...prev, [friendId]: !prev[friendId] }));
  };

  // Organize conversations
  const groupChats = conversations.filter(c => c.is_group);
  const threads = conversations.filter(c => !c.is_group);

  const getActiveConversationData = () => {
      return conversations.find(c => c.id === activeConversation);
  };

  // --- PREMIUM CSS INJECTION ---
  const premiumStyles = `
    * { box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body, html { margin: 0; padding: 0; background-color: #f3f4f6; color: #111827; }
    
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    
    .hover-bg:hover { background-color: #f3f4f6; }
    .hover-opacity:hover { opacity: 0.8; }
    
    .action-btn { color: #9ca3af; transition: all 0.2s; }
    .action-btn:hover { color: #111827; background-color: #e5e7eb; border-radius: 6px; }
    
    .delete-action:hover { color: #ef4444; background-color: #fee2e2; }

    .msg-bubble { transition: transform 0.2s ease; }
    .msg-bubble:hover .msg-delete-btn { opacity: 1; }
    
    .msg-delete-btn { opacity: 0; transition: opacity 0.2s; }

    .modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(17, 24, 39, 0.4); backdrop-filter: blur(4px);
        display: flex; justify-content: center; alignItems: center; z-index: 1000;
    }
    
    @media (max-width: 768px) {
      .app-layout { flex-direction: column !important; height: 100vh !important; border-radius: 0 !important; }
      .sidebar { width: 100% !important; height: 35vh !important; border-right: none !important; border-bottom: 1px solid #e5e7eb !important; }
      .main-wrapper { padding: 0 !important; }
    }
  `;

  // LOGIN SCREEN
  if (!user) {
    return (
      <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f9fafb" }}>
        <style>{premiumStyles}</style>
        <div style={{
          width: "100%", maxWidth: "380px", padding: "40px", borderRadius: "16px",
          background: "#ffffff", boxShadow: "0 10px 40px -10px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb"
        }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ width: "48px", height: "48px", background: "#111827", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <h2 style={{ margin: "0", fontSize: "24px", fontWeight: "600", color: "#111827" }}>
                {isLoginMode ? "Welcome Back" : "Create Account"}
            </h2>
            <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: "14px" }}>
                {isLoginMode ? "Sign in to continue to your workspace." : "Join the workspace to chat with friends."}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%", padding: "14px 16px", borderRadius: "10px", border: "1px solid #d1d5db",
                fontSize: "15px", outline: "none", transition: "border 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#111827"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
            
            {!isLoginMode && (
                <input
                  placeholder="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: "10px", border: "1px solid #d1d5db",
                    fontSize: "15px", outline: "none", transition: "border 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#111827"}
                  onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                />
            )}

            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%", padding: "14px 16px", borderRadius: "10px", border: "1px solid #d1d5db",
                fontSize: "15px", outline: "none", transition: "border 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#111827"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
              onKeyDown={(e) => { if (e.key === "Enter") handleAuth(); }}
            />

            <button
              onClick={handleAuth}
              className="hover-opacity"
              style={{
                width: "100%", padding: "14px", borderRadius: "10px", background: "#111827", color: "#ffffff",
                border: "none", fontWeight: "600", fontSize: "15px", cursor: "pointer", marginTop: "8px", transition: "0.2s"
              }}
            >
              {isLoginMode ? "Sign In" : "Sign Up"}
            </button>
            
            <div style={{ textAlign: "center", marginTop: "16px" }}>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                    {isLoginMode ? "Don't have an account? " : "Already have an account? "}
                </span>
                <button 
                    onClick={() => setIsLoginMode(!isLoginMode)}
                    style={{ background: "none", border: "none", color: "#111827", fontWeight: "600", cursor: "pointer", padding: "0" }}
                >
                    {isLoginMode ? "Sign Up" : "Sign In"}
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper to render a conversation item
  const renderConversationItem = (c, defaultName) => (
      <div 
        key={c.id} 
        className={c.id === activeConversation ? "" : "hover-bg"}
        style={{ 
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", 
          borderRadius: "8px", cursor: "pointer", transition: "0.2s",
          background: c.id === activeConversation ? "#111827" : "transparent",
        }}
        onClick={() => setActiveConversation(c.id)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, overflow: "hidden" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.id === activeConversation ? "#ffffff" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span style={{ fontSize: "13px", fontWeight: "500", color: c.id === activeConversation ? "#ffffff" : "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.display_name || defaultName}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button 
            onClick={(e) => { e.stopPropagation(); setRenameConvoId(c.id); setRenameInput(c.display_name); setShowRenameModal(true); }}
            className="action-btn"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
            title="Rename"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c.id === activeConversation ? "#9ca3af" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setChatToDelete(c.id); setShowDeleteModal(true); }}
            className="action-btn delete-action"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
            title="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c.id === activeConversation ? "#9ca3af" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
  );

  const activeConvoData = getActiveConversationData();

  return (
    <div className="main-wrapper" style={{ display: "flex", height: "100vh", background: "#f3f4f6", padding: "20px", justifyContent: "center", alignItems: "center" }}>
      <style>{premiumStyles}</style>

      {/* Profile Modal */}
      {showProfileModal && (
          <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
              <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "360px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: "0 0 16px" }}>Edit Profile</h3>
                  <div style={{ marginBottom: "16px" }}>
                      <label style={{ fontSize: "12px", color: "#6b7280", display: "block", marginBottom: "6px" }}>Username (Locked)</label>
                      <input disabled value={usernameContext} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#f9fafb", color: "#9ca3af", outline: "none" }} />
                  </div>
                  <div style={{ marginBottom: "20px" }}>
                      <label style={{ fontSize: "12px", color: "#6b7280", display: "block", marginBottom: "6px" }}>Display Name</label>
                      <input value={profileNameInput} onChange={e => setProfileNameInput(e.target.value)} placeholder="Enter new display name" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", outline: "none" }} />
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button onClick={() => setShowProfileModal(false)} style={{ padding: "8px 16px", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
                      <button onClick={handleEditProfile} style={{ padding: "8px 16px", background: "#111827", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Save</button>
                  </div>
              </div>
          </div>
      )}

      {/* Group Chat Modal */}
      {showGroupModal && (
          <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
              <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "360px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: "0 0 16px" }}>Create Group Chat</h3>
                  <input placeholder="Group Name (Optional)" value={groupNameInput} onChange={e => setGroupNameInput(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", marginBottom: "16px", outline: "none" }} />
                  <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "#4b5563" }}>Select Friends:</h4>
                  <div style={{ maxHeight: "150px", overflowY: "auto", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {friends.length === 0 && <span style={{fontSize:"13px", color:"#9ca3af"}}>No friends available.</span>}
                      {friends.map(f => (
                          <label key={f.id} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                              <input type="checkbox" checked={groupSelectedFriends.includes(f.id)} onChange={(e) => {
                                  if (e.target.checked) setGroupSelectedFriends([...groupSelectedFriends, f.id]);
                                  else setGroupSelectedFriends(groupSelectedFriends.filter(id => id !== f.id));
                              }} />
                              <span style={{ fontSize: "14px" }}>{f.display_name || f.username}</span>
                          </label>
                      ))}
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button onClick={() => setShowGroupModal(false)} style={{ padding: "8px 16px", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
                      <button disabled={groupSelectedFriends.length===0} onClick={handleCreateGroupChat} style={{ padding: "8px 16px", background: groupSelectedFriends.length===0?"#e5e7eb":"#111827", color: "white", border: "none", borderRadius: "8px", cursor: groupSelectedFriends.length===0?"not-allowed":"pointer", fontWeight: "600" }}>Create</button>
                  </div>
              </div>
          </div>
      )}
      
      {/* Invite Modal */}
      {showInviteModal && (
          <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
              <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "360px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: "0 0 16px" }}>Invite Friend to Group</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px", maxHeight: "150px", overflowY: "auto" }}>
                      {friends.length === 0 && <span style={{fontSize:"13px", color:"#9ca3af"}}>No friends available.</span>}
                      {friends.map(f => (
                          <label key={f.id} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                              <input type="radio" name="invitefriend" checked={inviteSelectedFriend === f.id} onChange={() => setInviteSelectedFriend(f.id)} />
                              <span style={{ fontSize: "14px" }}>{f.display_name || f.username}</span>
                          </label>
                      ))}
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button onClick={() => setShowInviteModal(false)} style={{ padding: "8px 16px", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
                      <button disabled={!inviteSelectedFriend} onClick={handleInviteUser} style={{ padding: "8px 16px", background: !inviteSelectedFriend?"#e5e7eb":"#111827", color: "white", border: "none", borderRadius: "8px", cursor: !inviteSelectedFriend?"not-allowed":"pointer", fontWeight: "600" }}>Invite</button>
                  </div>
              </div>
          </div>
      )}
      
      {/* Rename Chat Modal */}
      {showRenameModal && (
          <div className="modal-overlay" onClick={() => { setShowRenameModal(false); setRenameConvoId(null); }}>
              <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "360px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: "0 0 16px" }}>Rename Chat</h3>
                  <input placeholder="New Chat Name" value={renameInput} onChange={e => setRenameInput(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", marginBottom: "20px", outline: "none" }} />
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button onClick={() => { setShowRenameModal(false); setRenameConvoId(null); }} style={{ padding: "8px 16px", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
                      <button disabled={!renameInput.trim()} onClick={handleRenameChat} style={{ padding: "8px 16px", background: !renameInput.trim()?"#e5e7eb":"#111827", color: "white", border: "none", borderRadius: "8px", cursor: !renameInput.trim()?"not-allowed":"pointer", fontWeight: "600" }}>Rename</button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
          <div className="modal-overlay" onClick={() => { setShowDeleteModal(false); setChatToDelete(null); }}>
              <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "360px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: "0 0 16px", color: "#ef4444" }}>Delete Chat</h3>
                  <p style={{ margin: "0 0 20px", color: "#4b5563", fontSize: "14px", lineHeight: "1.5" }}>
                      Are you sure you want to delete this chat? This action cannot be undone.
                  </p>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button onClick={() => { setShowDeleteModal(false); setChatToDelete(null); }} style={{ padding: "8px 16px", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
                      <button onClick={() => { deleteConversation(chatToDelete); setShowDeleteModal(false); setChatToDelete(null); }} style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Delete</button>
                  </div>
              </div>
          </div>
      )}

      <div className="app-layout" style={{
        display: "flex", width: "100%", maxWidth: "1200px", height: "90vh",
        background: "#ffffff", borderRadius: "20px", boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)",
        overflow: "hidden", border: "1px solid #e5e7eb"
      }}>
        
        {/* --- SIDEBAR (LEFT COLUMN) --- */}
        <div className="sidebar" style={{ width: "320px", background: "#f9fafb", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
          
          {/* Header */}
          <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div 
              style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} 
              onClick={() => { setProfileNameInput(displayNameContext); setShowProfileModal(true); }}
              title="Edit Profile"
            >
              <div style={{ width: "32px", height: "32px", background: "#111827", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{color: "white", fontSize: "12px", fontWeight: "bold"}}>{(displayNameContext || usernameContext).charAt(0).toUpperCase()}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>{displayNameContext || usernameContext}</h3>
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>@{usernameContext}</span>
              </div>
            </div>
            <button className="hover-opacity" onClick={() => setShowGroupModal(true)} title="Create Group Chat" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "#111827" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>

          <div className="hide-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            
            {/* Find Users & Requests */}
            <div style={{ marginBottom: "24px" }}>
                <h4 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#9ca3af", margin: "0 0 8px 4px" }}>Search Users</h4>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <input 
                        placeholder="Username..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", outline: "none", fontSize: "13px" }}
                    />
                    <button onClick={handleSearch} style={{ background: "#111827", color: "white", border: "none", borderRadius: "6px", padding: "0 12px", cursor: "pointer", fontSize: "13px" }}>Find</button>
                </div>
                {searchResults.length > 0 && (
                    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px" }}>
                        {searchResults.map(resUser => (
                            <div key={resUser.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    <span style={{ fontSize: "13px", fontWeight: "500" }}>{resUser.display_name || resUser.username}</span>
                                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>@{resUser.username}</span>
                                </div>
                                <button onClick={() => sendRequest(resUser.id)} style={{ background: "#f3f4f6", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>Send Request</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {pendingRequests.length > 0 && (
                <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#f59e0b", margin: "0 0 8px 4px" }}>Pending Requests</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {pendingRequests.map(req => (
                            <div key={req.id} style={{ background: "#ffffff", border: "1px solid #fde68a", borderRadius: "8px", padding: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "13px", fontWeight: "500" }}>@{req.sender_username}</span>
                                <div style={{ display: "flex", gap: "4px" }}>
                                    <button onClick={() => acceptRequest(req.id)} style={{ background: "#10b981", color: "white", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>Accept</button>
                                    <button onClick={() => rejectRequest(req.id)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>Reject</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Friends Section (Folders for Threads) */}
            <h4 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#9ca3af", margin: "0 0 12px 4px" }}>Friends & Threads</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
              {friends.length === 0 && <div style={{ fontSize: "13px", color: "#9ca3af", paddingLeft: "4px" }}>No friends yet</div>}
              {friends.map(f => {
                const friendThreads = threads.filter(t => t.participants && t.participants.some(p => p.id === f.id));
                const isExpanded = expandedFriends[f.id];
                
                return (
                  <div key={f.id} style={{ display: "flex", flexDirection: "column", background: isExpanded ? "#ffffff" : "transparent", borderRadius: "8px", border: isExpanded ? "1px solid #e5e7eb" : "1px solid transparent", transition: "0.2s" }}>
                    
                    {/* Friend Row */}
                    <div 
                      onClick={() => toggleFriendExpand(f.id)}
                      className="hover-bg"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px",
                        borderRadius: "8px", cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "14px", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "600", color: "#4b5563" }}>
                          {(f.display_name || f.username).charAt(0).toUpperCase()}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>{f.display_name || f.username}</span>
                          <span style={{ fontSize: "10px", color: "#9ca3af" }}>{friendThreads.length} threads</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); createDirectChat(f.id); }}
                            className="hover-opacity"
                            style={{ background: "#e5e7eb", border: "none", borderRadius: "4px", padding: "4px", display: "flex", alignItems: "center", cursor: "pointer", color: "#4b5563" }}
                            title="Start New Thread"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "0.2s" }}>
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </div>

                    {/* Threads Accordion */}
                    {isExpanded && (
                      <div style={{ padding: "0 8px 8px 8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {friendThreads.length === 0 ? (
                              <div style={{ fontSize: "12px", color: "#9ca3af", padding: "4px 8px" }}>No threads yet. Create one!</div>
                          ) : (
                              friendThreads.map((t, index) => renderConversationItem(t, `New Thread ${index + 1}`))
                          )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* Group Chats List */}
            <h4 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#9ca3af", margin: "0 0 12px 4px" }}>Group Chats</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {groupChats.length === 0 && <div style={{ fontSize: "13px", color: "#9ca3af", paddingLeft: "4px" }}>No group chats</div>}
              {groupChats.map((c, index) => renderConversationItem(c, `Group Chat ${index + 1}`))}
            </div>

          </div>

          <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb" }}>
            <button
              onClick={logoutUser}
              className="hover-bg"
              style={{
                width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db",
                background: "#ffffff", color: "#374151", fontWeight: "600", fontSize: "14px", cursor: "pointer", transition: "0.2s"
              }}
            >
              Log Out
            </button>
          </div>
        </div>

        {/* --- MAIN CHAT AREA (RIGHT COLUMN) --- */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#ffffff", position: "relative" }}>
          
          {/* Top Info Bar */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff" }}>
            {activeConversation ? (
              <>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#111827" }}>
                  {activeConvoData?.display_name || (activeConvoData?.is_group ? "Group Chat" : "New Thread")}
                </h3>
                
                {activeConvoData?.is_group ? (
                    <button 
                      onClick={() => setShowInviteModal(true)} 
                      className="hover-bg"
                      style={{ display: "flex", alignItems: "center", gap: "6px", border: "1px solid #e5e7eb", background: "#ffffff", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#111827" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                      Invite Member
                    </button>
                ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "6px", background: "#ecfdf5", color: "#065f46", fontSize: "12px", fontWeight: "600", border: "1px solid #a7f3d0" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        Friend Status: Connected
                    </div>
                )}
              </>
            ) : (
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "400", color: "#9ca3af" }}>Select or start a chat</h3>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={messagesRef}
            className="hide-scrollbar"
            onScroll={() => {
              const el = messagesRef.current;
              if (!el) return;
              setIsNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
            }}
            style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {messages.length === 0 && activeConversation && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "14px" }}>
                No messages yet. Start the conversation.
              </div>
            )}
            
            {messages.map(msg => (
              <div
                key={msg.id}
                className="msg-bubble"
                style={{
                  alignSelf: msg.sender === user ? "flex-end" : "flex-start",
                  background: msg.sender === user ? "#111827" : "#f3f4f6",
                  color: msg.sender === user ? "#ffffff" : "#111827",
                  padding: "12px 16px",
                  borderRadius: "16px",
                  borderBottomRightRadius: msg.sender === user ? "4px" : "16px",
                  borderBottomLeftRadius: msg.sender !== user ? "4px" : "16px",
                  maxWidth: "75%",
                  position: "relative",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: "600", color: msg.sender === user ? "#9ca3af" : "#6b7280", marginBottom: "4px" }}>
                  {msg.sender === user ? "You" : msg.sender_username}
                </div>
                <div style={{ fontSize: "15px", lineHeight: "1.5" }}>{msg.content}</div>

                <button
                  className="msg-delete-btn"
                  onClick={() => deleteMessage(msg.id)}
                  style={{
                    position: "absolute", top: "-8px", right: msg.sender === user ? "-8px" : "auto", left: msg.sender !== user ? "-8px" : "auto",
                    background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "50%", width: "24px", height: "24px",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ef4444",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                  }}
                  title="Delete message"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ))}
            <div ref={bottomRef} style={{ height: "1px" }}></div>
          </div>

          {/* Jump to bottom button */}
          {!isNearBottom && (
            <button
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
              style={{
                position: "absolute", bottom: "100px", right: "32px",
                width: "40px", height: "40px", borderRadius: "20px", background: "#ffffff", border: "1px solid #e5e7eb",
                boxShadow: "0 4px 10px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#111827", zIndex: 10
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
            </button>
          )}

          {/* Message Input Area */}
          <div style={{ padding: "20px 24px", background: "#ffffff", borderTop: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "8px 8px 8px 16px" }}>
              <input
                disabled={!activeConversation}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={activeConversation ? "Type your message..." : "Select a chat to start messaging"}
                style={{
                  flex: 1, padding: "10px 0", border: "none", background: "transparent",
                  fontSize: "15px", outline: "none", color: "#111827"
                }}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              />

              <button
                disabled={!activeConversation || !newMessage.trim()}
                onClick={sendMessage}
                className="hover-opacity"
                style={{
                  width: "40px", height: "40px", borderRadius: "12px",
                  background: activeConversation && newMessage.trim() ? "#111827" : "#e5e7eb",
                  color: "#ffffff", border: "none", cursor: activeConversation && newMessage.trim() ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s"
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;