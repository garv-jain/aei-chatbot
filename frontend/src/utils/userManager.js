import { v4 as uuidv4 } from 'uuid';

class UserManager {
  constructor() {
    this.storageKey = 'aei_chatbot_user';
    this.user = this.loadUser();
  }

  loadUser() {
    try {
      const userData = localStorage.getItem(this.storageKey);
      if (userData) {
        return JSON.parse(userData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
    
    return this.createNewUser();
  }

  createNewUser() {
    const newUser = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    
    this.saveUser(newUser);
    return newUser;
  }

  saveUser(userData) {
    try {
      userData.lastActive = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(userData));
      this.user = userData;
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }

  getCurrentUser() {
    return this.user;
  }

  getUserId() {
    return this.user.id;
  }

  updateLastActive() {
    this.user.lastActive = new Date().toISOString();
    this.saveUser(this.user);
  }

  clearUser() {
    localStorage.removeItem(this.storageKey);
    this.user = this.createNewUser();
  }
}

export default UserManager;