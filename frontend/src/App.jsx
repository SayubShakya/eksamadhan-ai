import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './App.css'

// ⚡ BYPASS PINGGY SCREEN: Add header to all API requests
axios.defaults.headers.common['X-Pinggy-No-Screen'] = 'true';

function App() {
    const [tenantId, setTenantId] = useState('demo-tenant-1')
    const [status, setStatus] = useState(null)
    const [messages, setMessages] = useState([])
    const [replyText, setReplyText] = useState('')
    const [activeConversation, setActiveConversation] = useState(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const [selectedPageId, setSelectedPageId] = useState('all')

    const messagesEndRef = useRef(null)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    const FB_LOGO = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2" style={{ verticalAlign: 'middle', display: 'block' }}>
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
    );

    const IG_LOGO = (
        <svg width="16" height="16" viewBox="0 0 24 24" style={{ verticalAlign: 'middle', display: 'block' }}>
            <defs>
                <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#fed373' }} />
                    <stop offset="25%" style={{ stopColor: '#f15245' }} />
                    <stop offset="50%" style={{ stopColor: '#d92e7f' }} />
                    <stop offset="75%" style={{ stopColor: '#9b36b7' }} />
                    <stop offset="100%" style={{ stopColor: '#515ecf' }} />
                </linearGradient>
            </defs>
            <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.209-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
    );



    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        checkStatus()
        // ⚡ POLLING: Check messages frequently (0.5s) and status occasionally (2s)
        const msgInterval = setInterval(fetchMessages, 500)
        const statusInterval = setInterval(checkStatus, 2000)

        // Handle platform redirect hint
        const params = new URLSearchParams(window.location.search);
        const platformHint = params.get('platform');
        if (platformHint === 'facebook' || platformHint === 'instagram') {
            console.log(`🎯 Setting initial filter to platform: ${platformHint}`);
            setSelectedPageId(platformHint);

            // ⚡ FORCE REFRESH STATUS: Re-check with backend to see the NEW page list
            checkStatus();

            // Cleanup URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        return () => {
            clearInterval(msgInterval)
            clearInterval(statusInterval)
        }
    }, [tenantId])

    // Auto-sync with Facebook every 5 seconds
    useEffect(() => {
        if (status?.connected) {
            // Initial sync on connect
            handleSync(true)

            const syncInterval = setInterval(() => {
                handleSync(true)
            }, 30000)

            return () => clearInterval(syncInterval)
        }
    }, [status?.connected, tenantId])

    const handleSync = async (isBackground = false) => {
        if (!isBackground) setIsSyncing(true)
        try {
            await axios.post(`/api/messages/sync/${tenantId}`)
            fetchMessages()
        } catch (err) {
            console.error('Sync failed', err)
        } finally {
            if (!isBackground) setIsSyncing(false)
        }
    }

    const checkStatus = async () => {
        try {
            const res = await axios.get(`/api/auth/status/${tenantId}`)
            setStatus(res.data)
        } catch (err) {
            console.error('Failed to check status', err)
        }
    }

    const fetchMessages = async () => {
        try {
            const res = await axios.get(`/api/messages/${tenantId}`)
            // ⚡ Only update state if data changed to prevent "blocking" scroll
            setMessages(prev => {
                if (prev.length === res.data.length &&
                    prev[prev.length - 1]?.id === res.data[res.data.length - 1]?.id) {
                    return prev
                }
                return res.data
            })
        } catch (err) {
            console.error('Failed to fetch messages', err)
        }
    }

    const handleConnect = (platform = 'facebook') => {
        window.location.href = `/api/auth/${platform}?tenantId=${tenantId}`
    }

    // ⚡ Scroll to top of page when selecting a conversation (helps with filtering)
    useEffect(() => {
        if (activeConversation) {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
        // Force scroll to bottom of chat only when switching conversations
        scrollToBottom()
    }, [activeConversation?.userId])

    // ⚡ Intelligent scroll-to-bottom for new messages
    useEffect(() => {
        const messageBox = messagesEndRef.current?.parentNode
        if (messageBox) {
            const isNearBottom = messageBox.scrollHeight - messageBox.scrollTop - messageBox.clientHeight < 100
            if (isNearBottom) {
                scrollToBottom()
            }
        }
    }, [messages])

    const handleSendReply = async (e) => {
        e.preventDefault()
        if (!replyText || !activeConversation) return

        const textToSend = replyText
        setReplyText('') // ⚡ Clear input immediately

        // ⚡ Optimistic UI Update: Show message immediately
        const optimisticId = `temp_${Date.now()}`
        const newReply = {
            id: optimisticId,
            direction: 'outbound',
            text: textToSend,
            senderId: activeConversation.pageId,
            recipientId: activeConversation.userId,
            timestamp: new Date().toISOString(),
            status: 'sending'
        }
        setMessages(prev => [...prev, newReply])

        try {
            // Send in background
            await axios.post(`/api/messages/reply/${tenantId}`, {
                pageId: activeConversation.pageId,
                recipientId: activeConversation.userId,
                text: textToSend
            })

            // Note: We don't need to do anything here, the background sync 
            // will eventually fetch the real message with the real ID.
        } catch (err) {
            console.error('Send failed', err)
            const errorMsg = err.response?.data?.error || err.response?.data?.details || 'Failed to send'
            alert(`Error: ${errorMsg}`)
            // Remove the optimistic message on failure
            setMessages(prev => prev.filter(m => m.id !== optimisticId))
            setReplyText(textToSend) // Restore text
        }
    }

    const handleLogout = async () => {
        if (!window.confirm('This will disconnect ALL pages and clear history. Continue?')) return
        try {
            console.log('🚪 Disconnecting tenant:', tenantId)
            await axios.post(`/api/auth/logout/${tenantId}`)

            // ⚡ Reset ALL local states
            setStatus(null)
            setMessages([])
            setActiveConversation(null)
            setSelectedPageId('all')
            setReplyText('')

            // ⚡ Redirect to home and refresh to ensure a clean slate
            window.location.href = '/'
        } catch (err) {
            console.error('Logout failed', err)
            // Even if the API fails, we should still try to clear local view 
            // but alert the user if they want to retry.
            if (window.confirm('Logout request failed on server. Clear local view anyway?')) {
                window.location.href = '/'
            }
        }
    }

    // Generate a consistent color from a string
    const getAvatarColor = (name) => {
        const colors = [
            '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FF8F33',
            '#33FFF5', '#8F33FF', '#FF3333', '#33FF8F', '#5733FF'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    // ⚡ FORMAT TIMESTAMP FOR INBOX (matches image)
    const formatTimestamp = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        const now = new Date();

        const isToday = date.toDateString() === now.toDateString();
        const isThisYear = date.getFullYear() === now.getFullYear();

        if (isToday) {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kathmandu'
            });
        } else if (isThisYear) {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                timeZone: 'Asia/Kathmandu'
            });
        } else {
            // For older years, show date in M/D/YY format as seen in image for '8/9/25'
            const m = date.getMonth() + 1;
            const d = date.getDate();
            const y = date.getFullYear().toString().slice(-2);
            return `${m}/${d}/${y}`;
        }
    };

    // ⚡ FORMAT FULL TIMESTAMP FOR MESSAGE DETAIL
    const formatMessageTime = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return isoString;

            const now = new Date();
            const isThisYear = date.getFullYear() === now.getFullYear();

            const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Kathmandu' });
            const day = date.getDate();
            const time = date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kathmandu'
            });

            if (isThisYear) {
                return `${month} ${day}, ${time}`;
            } else {
                return `${month} ${day}, ${date.getFullYear()}, ${time}`;
            }
        } catch (e) {
            return isoString;
        }
    };

    return (
        <div className="dashboard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1>Azmew Social Connector POC</h1>
                {status?.connected && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleLogout} style={{ backgroundColor: '#ff4444', fontSize: '0.8em', padding: '8px 15px' }}>
                            Logout / Disconnect
                        </button>
                    </div>
                )}
            </div>

            <div className="connection-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>Connected Digital Channels</h2>
                    {status?.connected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8em', color: '#888', fontWeight: '500' }}>Filter:</span>
                            <div style={{ display: 'flex', background: '#222', padding: '3px', borderRadius: '8px', border: '1px solid #333' }}>
                                <button
                                    onClick={() => setSelectedPageId('all')}
                                    style={{
                                        padding: '5px 12px',
                                        fontSize: '0.75em',
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: selectedPageId === 'all' ? '#444' : 'transparent',
                                        color: 'white',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setSelectedPageId('facebook')}
                                    style={{
                                        padding: '5px 12px',
                                        fontSize: '0.75em',
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: selectedPageId === 'facebook' ? '#1877F2' : 'transparent',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {React.cloneElement(FB_LOGO, { fill: 'white' })} Facebook
                                </button>
                                <button
                                    onClick={() => setSelectedPageId('instagram')}
                                    style={{
                                        padding: '5px 12px',
                                        fontSize: '0.75em',
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: selectedPageId === 'instagram' ? 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)' : 'transparent',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {React.cloneElement(IG_LOGO, { style: { filter: 'brightness(10)' } })} Instagram
                                </button>

                            </div>
                        </div>
                    )}
                </div>
                {status?.connected ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px', alignItems: 'center' }}>
                        {/* Always show pages matching the current filter */}
                        {status.data.pages
                            .filter(p => {
                                if (selectedPageId === 'all') return true;
                                if (selectedPageId === 'facebook') return p.platform === 'facebook';
                                if (selectedPageId === 'instagram') return p.platform === 'instagram';
                                if (selectedPageId === 'tiktok') return p.platform === 'tiktok';
                                return p.pageId === selectedPageId;
                            })
                            .map(page => (
                                <div key={page.pageId} style={{
                                    background: '#333',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    fontSize: '0.8em',
                                    border: page.platform === 'instagram' ? '1px solid #e1306c' : '1px solid #3b5998',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span style={{ display: 'flex', alignItems: 'center' }}>
                                        {page.platform === 'instagram' ? IG_LOGO : FB_LOGO}
                                    </span>
                                    <span>{page.pageName}</span>
                                </div>
                            ))
                        }

                        <div style={{ display: 'flex', gap: '5px', marginLeft: '10px', borderLeft: '1px solid #444', paddingLeft: '10px' }}>
                            <button onClick={() => handleConnect('facebook')} title="Add Facebook Page" style={{ fontSize: '0.7em', padding: '4px 8px', background: '#3b5998', borderRadius: '4px' }}>+ FB</button>
                            <button onClick={() => handleConnect('instagram')} title="Add Instagram Account" style={{ fontSize: '0.7em', padding: '4px 8px', background: '#e1306c', borderRadius: '4px' }}>+ IG</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <p>No channels connected. Link your social media to start.</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => handleConnect('facebook')} style={{ background: '#3b5998' }}>Connect Facebook</button>
                            <button onClick={() => handleConnect('instagram')} style={{ background: '#e1306c' }}>Connect Instagram</button>
                        </div>
                    </div>
                )}
            </div>

            {status?.connected && (
                <div className="messenger-container" style={{
                    display: 'flex',
                    marginTop: '30px',
                    height: '80vh',
                    background: '#111',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #333',
                    flexDirection: isMobile ? 'column' : 'row'
                }}>
                    {/* Conversations Sidebar */}
                    <div className="conv-sidebar" style={{
                        width: isMobile ? '100%' : '300px',
                        borderRight: isMobile ? 'none' : '1px solid #333',
                        background: '#1a1a1a',
                        display: isMobile && activeConversation ? 'none' : 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ padding: '15px', borderBottom: '1px solid #333', fontWeight: 'bold', fontSize: '0.9em', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Conversations</span>
                            <span style={{ fontSize: '0.7em', color: '#666' }}>
                                {selectedPageId === 'all' ? 'All' : selectedPageId === 'facebook' ? 'Facebook' : selectedPageId === 'instagram' ? 'Instagram' : status.data.pages.find(p => p.pageId === selectedPageId)?.pageName || 'Filtered'}
                            </span>
                        </div>
                        <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                            {(() => {
                                // 1. Identify all unique customer IDs
                                const customerIds = new Set();
                                const pageIds = new Set(status.data.pages.map(p => p.pageId));

                                // 2. Identify all currently connected IDs for the target platform(s)
                                const activePages = status.data.pages;
                                const activePageIds = new Set(activePages.map(p => p.pageId));

                                // 3. Filter messages based on selection (All, Platform, or Specific Page)
                                let filteredMessages = messages;

                                if (selectedPageId === 'facebook') {
                                    const fbPageIds = new Set(activePages.filter(p => p.platform === 'facebook').map(p => p.pageId));
                                    filteredMessages = messages.filter(m => fbPageIds.has(m.pageId));
                                } else if (selectedPageId === 'instagram') {
                                    const igPageIds = new Set(activePages.filter(p => p.platform === 'instagram').map(p => p.pageId));
                                    filteredMessages = messages.filter(m => igPageIds.has(m.pageId));
                                } else if (selectedPageId !== 'all') {
                                    // Specific Page selected
                                    filteredMessages = messages.filter(m => m.pageId === selectedPageId);
                                } else {
                                    // "All Channels" selected - Only show messages from pages that are CURRENTLY connected
                                    filteredMessages = messages.filter(m => activePageIds.has(m.pageId));
                                }

                                filteredMessages.forEach(m => {
                                    if (!pageIds.has(m.senderId)) customerIds.add(m.senderId);
                                    if (!pageIds.has(m.recipientId)) customerIds.add(m.recipientId);
                                });

                                // 3. Create thread objects and sort them
                                const threads = Array.from(customerIds).map(customerId => {
                                    const threadMsgs = filteredMessages.filter(m => m.senderId === customerId || m.recipientId === customerId);
                                    if (threadMsgs.length === 0) return null;

                                    // Sort messages in thread by time just to be safe for lastMsg
                                    threadMsgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                                    const lastMsg = threadMsgs[threadMsgs.length - 1];
                                    const inboundMsg = threadMsgs.find(m => m.direction === 'inbound');
                                    const pageId = threadMsgs.find(m => m.pageId)?.pageId;
                                    const senderName = (inboundMsg?.senderName) || `User ${customerId}`;

                                    return {
                                        customerId,
                                        senderName,
                                        lastMsg,
                                        pageId,
                                        timestamp: new Date(lastMsg.timestamp).getTime()
                                    };
                                }).filter(Boolean); // Remove nulls

                                // ⚡ SORT BY TIMESTAMP DESCENDING (Newest on top)
                                threads.sort((a, b) => b.timestamp - a.timestamp);


                                return threads.map(({ customerId, senderName, lastMsg, pageId }) => (
                                    <div
                                        key={customerId}
                                        onClick={() => setActiveConversation({ userId: customerId, pageId, name: senderName })}
                                        className="conversation-item"
                                        style={{
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            backgroundColor: activeConversation?.userId === customerId ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                            borderRadius: '8px',
                                            margin: '4px 8px',
                                            transition: 'background-color 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (activeConversation?.userId !== customerId) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (activeConversation?.userId !== customerId) e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                    >
                                        {/* Avatar Placeholder with Platform Badge */}
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <div style={{
                                                width: '45px',
                                                height: '45px',
                                                borderRadius: '50%',
                                                backgroundColor: getAvatarColor(senderName),
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.2em',
                                                fontWeight: '600',
                                                color: '#fff',
                                            }}>
                                                {senderName.charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '-2px',
                                                right: '-2px',
                                                backgroundColor: '#fff',
                                                borderRadius: '50%',
                                                width: '18px',
                                                height: '18px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                            }}>
                                                {(() => {
                                                    const page = status.data.pages.find(p => p.pageId === pageId);
                                                    const platform = page?.platform || 'facebook';
                                                    return React.cloneElement(
                                                        platform === 'instagram' ? IG_LOGO : FB_LOGO,
                                                        { width: 12, height: 12 }
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Text Content */}
                                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                                <span style={{
                                                    fontWeight: '600',
                                                    fontSize: '0.95em',
                                                    color: '#e4e6eb',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {senderName}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.75em',
                                                    color: '#b0b3b8',
                                                    flexShrink: 0,
                                                    marginLeft: '8px'
                                                }}>
                                                    {formatTimestamp(lastMsg.timestamp)}
                                                </span>
                                            </div>
                                            <div style={{
                                                fontSize: '0.85em',
                                                color: activeConversation?.userId === customerId ? '#b0b3b8' : '#888',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {lastMsg.direction === 'outbound' ? 'You: ' : ''}{lastMsg.text}
                                            </div>
                                        </div>
                                    </div>
                                ));
                            })()}
                            {messages.length === 0 && (
                                <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.8em', color: '#666' }}>No chats found</div>
                            )}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="chat-main" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
                        {activeConversation ? (
                            <>
                                <div style={{ padding: '15px', borderBottom: '1px solid #333', background: '#151515', fontSize: '0.9em', display: 'flex', alignItems: 'center' }}>
                                    {isMobile && (
                                        <button
                                            onClick={() => setActiveConversation(null)}
                                            style={{ marginRight: '10px', background: 'transparent', border: 'none', color: '#0084ff', fontSize: '1.2em', cursor: 'pointer' }}
                                        >
                                            ←
                                        </button>
                                    )}
                                    <div style={{ flexGrow: 1 }}>
                                        To: <strong>{activeConversation.name}</strong>
                                        <div style={{ color: '#aaa', fontSize: '0.8em', marginTop: '2px' }}>
                                            {(() => {
                                                const page = status.data.pages.find(p => p.pageId === activeConversation.pageId);
                                                if (!page) return <span style={{ color: '#888' }}>Channel details unavailable</span>;
                                                return (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {page.platform === 'instagram' ? IG_LOGO : FB_LOGO}
                                                        Connected via <strong>{page.pageName}</strong>
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="message-box" style={{ flexGrow: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', height: 'auto' }}>
                                    {messages.filter(m =>
                                        m.senderId === activeConversation.userId ||
                                        m.recipientId === activeConversation.userId
                                    ).map(msg => (
                                        <div key={msg.id} className={`message ${msg.direction}`} style={{
                                            alignSelf: msg.direction === 'inbound' ? 'flex-start' : 'flex-end',
                                            background: msg.direction === 'inbound' ? '#333' : '#0084ff',
                                            padding: '8px 15px',
                                            borderRadius: '15px',
                                            maxWidth: '70%',
                                            fontSize: '0.9em'
                                        }}>
                                            <p style={{ margin: 0 }}>{msg.text}</p>
                                            <small style={{ fontSize: '0.7em', marginTop: '4px', display: 'block', opacity: 0.7 }}>
                                                {formatMessageTime(msg.timestamp)}
                                            </small>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                                <form onSubmit={handleSendReply} className="reply-input" style={{ padding: '20px', background: '#151515', borderTop: '1px solid #333', display: 'flex', gap: '10px' }}>
                                    <input
                                        type="text"
                                        placeholder={`Message ${activeConversation.name}...`}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        style={{ flexGrow: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: 'white' }}
                                    />
                                    <button type="submit" disabled={!replyText}>Send</button>
                                </form>
                            </>
                        ) : (
                            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                                Select a conversation to start chatting
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
