<template>
  <div class="login-container">
    <div class="login-card">
      <!-- Logo and Branding -->
      <div class="brand-header">
        <img src="/static/images/Globe-clear-256x256.png" alt="OmniBazaar" class="logo" />
        <h1 class="brand-title">Welcome to OmniBazaar</h1>
        <p class="brand-subtitle">Your decentralized marketplace for everything</p>
      </div>

      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button 
          :class="['tab-button', { active: activeTab === 'login' }]"
          @click="activeTab = 'login'"
        >
          Sign In
        </button>
        <button 
          :class="['tab-button', { active: activeTab === 'register' }]"
          @click="activeTab = 'register'"
        >
          Create Account
        </button>
      </div>

      <!-- Login Form -->
      <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="auth-form">
        <h2 class="form-title">Sign In to Your Account</h2>
        
        <div class="form-group">
          <label for="login-username" class="form-label">Username</label>
          <input
            id="login-username"
            v-model="loginForm.username"
            type="text"
            class="form-input"
            placeholder="Enter your username"
            :disabled="isLoading"
            required
          />
        </div>

        <div class="form-group">
          <label for="login-password" class="form-label">Password</label>
          <div class="password-input-wrapper">
            <input
              id="login-password"
              v-model="loginForm.password"
              :type="showLoginPassword ? 'text' : 'password'"
              class="form-input"
              placeholder="Enter your password"
              :disabled="isLoading"
              required
            />
            <button
              type="button"
              class="password-toggle"
              @click="showLoginPassword = !showLoginPassword"
            >
              {{ showLoginPassword ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
        </div>

        <button type="submit" class="submit-button" :disabled="isLoading">
          <span v-if="isLoading" class="loading-spinner"></span>
          {{ isLoading ? 'Signing In...' : 'Sign In' }}
        </button>

        <div class="form-links">
          <a href="#" @click.prevent="showForgotPassword = true" class="link">
            Forgot your password?
          </a>
        </div>
      </form>

      <!-- Registration Form -->
      <form v-if="activeTab === 'register'" @submit.prevent="handleRegister" class="auth-form">
        <h2 class="form-title">Create Your Account</h2>
        
        <div class="form-group">
          <label for="register-username" class="form-label">Choose Username</label>
          <input
            id="register-username"
            v-model="registerForm.username"
            type="text"
            class="form-input"
            :class="{ 'error': usernameError }"
            placeholder="Choose a unique username"
            :disabled="isLoading"
            @input="checkUsernameAvailability"
            required
          />
          <div v-if="usernameError" class="error-message">{{ usernameError }}</div>
          <div v-if="usernameAvailable && registerForm.username" class="success-message">
            ✓ Username available
          </div>
        </div>

        <div class="form-group">
          <label for="register-password" class="form-label">Create Password</label>
          <div class="password-input-wrapper">
            <input
              id="register-password"
              v-model="registerForm.password"
              :type="showRegisterPassword ? 'text' : 'password'"
              class="form-input"
              :class="{ 'error': passwordError }"
              placeholder="Create a strong password"
              :disabled="isLoading"
              @input="validatePassword"
              required
            />
            <button
              type="button"
              class="password-toggle"
              @click="showRegisterPassword = !showRegisterPassword"
            >
              {{ showRegisterPassword ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <div class="password-strength">
            <div class="strength-bar">
              <div 
                class="strength-fill" 
                :class="passwordStrength.level"
                :style="{ width: passwordStrength.percentage + '%' }"
              ></div>
            </div>
            <span class="strength-text">{{ passwordStrength.text }}</span>
          </div>
          <div v-if="passwordError" class="error-message">{{ passwordError }}</div>
        </div>

        <div class="form-group">
          <label for="confirm-password" class="form-label">Confirm Password</label>
          <input
            id="confirm-password"
            v-model="registerForm.confirmPassword"
            type="password"
            class="form-input"
            :class="{ 'error': confirmPasswordError }"
            placeholder="Confirm your password"
            :disabled="isLoading"
            @input="validateConfirmPassword"
            required
          />
          <div v-if="confirmPasswordError" class="error-message">{{ confirmPasswordError }}</div>
        </div>

        <div class="terms-checkbox">
          <input
            id="terms"
            v-model="registerForm.agreeToTerms"
            type="checkbox"
            class="checkbox"
            required
          />
          <label for="terms" class="checkbox-label">
            I agree to the <a href="#" class="link">Terms of Service</a> and 
            <a href="#" class="link">Privacy Policy</a>
          </label>
        </div>

        <button 
          type="submit" 
          class="submit-button" 
          :disabled="isLoading || !isFormValid"
        >
          <span v-if="isLoading" class="loading-spinner"></span>
          {{ isLoading ? 'Creating Account...' : 'Create Account' }}
        </button>
      </form>

      <!-- Error/Success Messages -->
      <div v-if="errorMessage" class="message error-message-global">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="message success-message-global">
        {{ successMessage }}
      </div>

      <!-- Forgot Password Modal -->
      <div v-if="showForgotPassword" class="modal-overlay" @click="showForgotPassword = false">
        <div class="modal-content" @click.stop>
          <h3>Password Recovery</h3>
          <p>
            Password recovery requires your username and will regenerate your account access.
            This is a security feature that ensures only you can access your account.
          </p>
          <div class="form-group">
            <label>Username</label>
            <input
              v-model="forgotPasswordUsername"
              type="text"
              class="form-input"
              placeholder="Enter your username"
            />
          </div>
          <div class="modal-actions">
            <button @click="showForgotPassword = false" class="button secondary">
              Cancel
            </button>
            <button @click="handleForgotPassword" class="button primary">
              Recover Account
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Login Form Component
 * 
 * Handles user authentication with both sign in and registration tabs
 */
import { ref, computed, onMounted } from 'vue'
import { KeyringManager } from '../../core/keyring/KeyringManager'

// Define user session type
interface UserSession {
  username: string
  accounts: {
    omnicoin: {
      address: string
    }
  }
}

// Form state
const activeTab = ref<'login' | 'register'>('login')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Login form
const loginForm = ref({
  username: '',
  password: ''
})
const showLoginPassword = ref(false)

// Registration form
const registerForm = ref({
  username: '',
  password: '',
  confirmPassword: '',
  agreeToTerms: false
})
const showRegisterPassword = ref(false)

// Validation state
const usernameError = ref('')
const usernameAvailable = ref(false)
const passwordError = ref('')
const confirmPasswordError = ref('')

// Forgot password
const showForgotPassword = ref(false)
const forgotPasswordUsername = ref('')

// Password strength
const passwordStrength = computed(() => {
  const password = registerForm.value.password
  if (password.length === 0) return { level: '', percentage: 0, text: '' }

  let score = 0
  const feedback: string[] = []

  // Length check
  if (password.length >= 12) score += 25
  else feedback.push('at least 12 characters')

  // Uppercase check
  if (/[A-Z]/.test(password)) score += 25
  else feedback.push('uppercase letter')

  // Lowercase check
  if (/[a-z]/.test(password)) score += 25
  else feedback.push('lowercase letter')

  // Number or symbol check
  if (/[\d\W]/.test(password)) score += 25
  else feedback.push('number or symbol')

  let level = ''
  let text = ''

  if (score < 50) {
    level = 'weak'
    text = `Weak - Add ${feedback.join(', ')}`
  } else if (score < 75) {
    level = 'medium'
    text = 'Good - ' + (feedback.length > 0 ? `Add ${feedback.join(', ')}` : 'Strong password')
  } else {
    level = 'strong'
    text = 'Strong password ✓'
  }

  return { level, percentage: score, text }
})

// Form validation
const isFormValid = computed(() => {
  return registerForm.value.username.length > 0 &&
         registerForm.value.password.length > 0 &&
         registerForm.value.confirmPassword.length > 0 &&
         registerForm.value.agreeToTerms &&
         usernameError.value.length === 0 &&
         passwordError.value.length === 0 &&
         confirmPasswordError.value.length === 0 &&
         usernameAvailable.value
})

// Methods
/**
 * Handle user login
 */
const handleLogin = async (): Promise<void> => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
    const keyring = KeyringManager.getInstance()
    const session = await keyring.loginUser({
      username: loginForm.value.username,
      password: loginForm.value.password
    })
    
    successMessage.value = `Welcome back, ${session.username}!`
    
    // Emit login success event or navigate
    emit('login-success', session)
    
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login failed'
  } finally {
    isLoading.value = false
  }
}

/**
 * Handle user registration
 */
const handleRegister = async (): Promise<void> => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
    const keyring = KeyringManager.getInstance()
    const session = await keyring.registerUser({
      username: registerForm.value.username,
      password: registerForm.value.password
    })
    
    successMessage.value = `Account created successfully! Welcome, ${session.username}!`
    
    // Emit registration success event or navigate
    emit('register-success', session)
    
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Registration failed'
  } finally {
    isLoading.value = false
  }
}

/**
 * Check username availability
 */
const checkUsernameAvailability = (): void => {
  const username = registerForm.value.username
  
  if (username.length === 0) {
    usernameError.value = ''
    usernameAvailable.value = false
    return
  }

  // Basic validation
  if (username.length < 3) {
    usernameError.value = 'Username must be at least 3 characters'
    usernameAvailable.value = false
    return
  }

  if (username.length > 20) {
    usernameError.value = 'Username must be less than 20 characters'
    usernameAvailable.value = false
    return
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    usernameError.value = 'Username can only contain letters, numbers, hyphens, and underscores'
    usernameAvailable.value = false
    return
  }

  // TODO: Check availability with backend
  // For now, simulate check
  usernameError.value = ''
  usernameAvailable.value = true
}

/**
 * Validate password strength
 */
const validatePassword = (): void => {
  const password = registerForm.value.password
  
  if (password.length === 0) {
    passwordError.value = ''
    return
  }

  if (password.length < 12) {
    passwordError.value = 'Password must be at least 12 characters'
    return
  }

  passwordError.value = ''
}

/**
 * Validate confirm password
 */
const validateConfirmPassword = (): void => {
  const password = registerForm.value.password
  const confirmPassword = registerForm.value.confirmPassword
  
  if (confirmPassword.length === 0) {
    confirmPasswordError.value = ''
    return
  }

  if (password !== confirmPassword) {
    confirmPasswordError.value = 'Passwords do not match'
    return
  }

  confirmPasswordError.value = ''
}

/**
 * Handle forgot password
 */
const handleForgotPassword = (): void => {
  // TODO: Implement password recovery
  // eslint-disable-next-line no-console
  console.log('Password recovery for:', forgotPasswordUsername.value)
  showForgotPassword.value = false
}

// Events
const emit = defineEmits<{
  'login-success': [session: UserSession]
  'register-success': [session: UserSession]
}>()

// Lifecycle
onMounted(() => {
  // Check if user is already logged in
  const keyring = KeyringManager.getInstance()
  const session = keyring.getCurrentSession()
  if (session !== null) {
    emit('login-success', session)
  }
})
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 480px;
}

.brand-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
}

.brand-title {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
}

.brand-subtitle {
  color: #666;
  font-size: 16px;
}

.tab-navigation {
  display: flex;
  margin-bottom: 32px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 4px;
}

.tab-button {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-button.active {
  background: white;
  color: #333;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.auth-form {
  margin-bottom: 24px;
}

.form-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin-bottom: 24px;
  text-align: center;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input.error {
  border-color: #ef4444;
}

.password-input-wrapper {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px;
}

.password-strength {
  margin-top: 8px;
}

.strength-bar {
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s;
}

.strength-fill.weak { background: #ef4444; }
.strength-fill.medium { background: #f59e0b; }
.strength-fill.strong { background: #10b981; }

.strength-text {
  font-size: 12px;
  color: #666;
}

.terms-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 24px;
}

.checkbox {
  margin-top: 2px;
}

.checkbox-label {
  font-size: 14px;
  color: #666;
  line-height: 1.4;
}

.submit-button {
  width: 100%;
  padding: 14px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.submit-button:hover:not(:disabled) {
  background: #5a6fd8;
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.form-links {
  text-align: center;
  margin-top: 16px;
}

.link {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
}

.link:hover {
  text-decoration: underline;
}

.error-message {
  color: #ef4444;
  font-size: 14px;
  margin-top: 4px;
}

.success-message {
  color: #10b981;
  font-size: 14px;
  margin-top: 4px;
}

.message {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  text-align: center;
}

.error-message-global {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.success-message-global {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.button {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}

.button.primary {
  background: #667eea;
  color: white;
}

.button.secondary {
  background: #f3f4f6;
  color: #374151;
}
</style>