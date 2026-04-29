import React, { createContext, useContext, useReducer } from 'react';

const MessageContext = createContext();

// Message reducer for managing messages across groups
const messageReducer = (state, action) => {
  switch (action.type) {
    case 'SET_MESSAGES':
      return {
        ...state,
        [action.groupId]: action.messages
      };
    
    case 'ADD_MESSAGE':
      return {
        ...state,
        [action.groupId]: [...(state[action.groupId] || []), action.message]
      };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        [action.groupId]: state[action.groupId].map(msg => 
          msg.id === action.messageId ? { ...msg, ...action.updates } : msg
        )
      };
    
    case 'DELETE_MESSAGE':
      return {
        ...state,
        [action.groupId]: state[action.groupId].filter(msg => msg.id !== action.messageId)
      };
    
    default:
      return state;
  }
};

export const MessageProvider = ({ children }) => {
  const [messages, dispatch] = useReducer(messageReducer, {});

  const setGroupMessages = (groupId, messageList) => {
    dispatch({ type: 'SET_MESSAGES', groupId, messages: messageList });
  };

  const addMessage = (groupId, message) => {
    dispatch({ type: 'ADD_MESSAGE', groupId, message });
  };

  const updateMessage = (groupId, messageId, updates) => {
    dispatch({ type: 'UPDATE_MESSAGE', groupId, messageId, updates });
  };

  const deleteMessage = (groupId, messageId) => {
    dispatch({ type: 'DELETE_MESSAGE', groupId, messageId });
  };

  const getGroupMessages = (groupId) => {
    return messages[groupId] || [];
  };

  return (
    <MessageContext.Provider value={{
      messages,
      setGroupMessages,
      addMessage,
      updateMessage,
      deleteMessage,
      getGroupMessages
    }}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessages must be used within MessageProvider');
  }
  return context;
};