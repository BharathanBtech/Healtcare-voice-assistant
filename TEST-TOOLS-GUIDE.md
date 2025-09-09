# 🧪 Test Tools Guide

## 🚀 Quick Start

The test tools are now integrated into the backend server to avoid CORS issues. Access them through these URLs:

### 📋 Available Test Tools:

1. **Voice Session Flow Test**
   ```
   http://localhost:3001/test/voice-session
   ```
   - Tests complete voice session workflow
   - Creates sessions, updates data, completes sessions
   - Shows real-time progress and session details

2. **Connection Test**
   ```
   http://localhost:3001/test/connection
   ```
   - Tests basic backend connectivity
   - Verifies authentication flow
   - Tests provider API endpoints

3. **Voice Timeout Debug**
   ```
   http://localhost:3001/test/debug-voice
   ```
   - Debug speech recognition timeouts
   - Adjustable timeout settings
   - Real-time speech detection monitoring

## 🔧 Prerequisites

1. **Backend Server Must Be Running:**
   ```bash
   npm run dev:server
   ```

2. **Database Must Be Accessible:**
   - PostgreSQL running on 172.16.10.130:5432
   - Database: `voiceagent`
   - User credentials configured

## 🎯 How to Use:

### Voice Session Test:
1. Open `http://localhost:3001/test/voice-session`
2. Click "🧪 Test Complete Voice Session Flow"
3. Watch the step-by-step process
4. Check session details panel for real-time updates

### Connection Test:
1. Open `http://localhost:3001/test/connection`
2. Click "Run All Tests"
3. Verify all connections pass
4. Check for any authentication issues

### Voice Debug:
1. Open `http://localhost:3001/test/debug-voice`
2. Adjust timeout settings if needed
3. Click "🎤 Start Listening"
4. Speak clearly and watch the timer
5. Observe silence detection behavior

## 🐛 Troubleshooting:

### If Tests Fail:
1. **Check Backend Server:**
   ```bash
   netstat -ano | findstr :3001
   ```

2. **Verify Database Connection:**
   ```bash
   curl http://localhost:3001/api/health/db
   ```

3. **Check Authentication:**
   - Default credentials: `demo` / `demo123`
   - Admin credentials: `admin` / `admin123`

### Common Issues:
- **CORS Errors**: Use the server-hosted URLs (`localhost:3001/test/...`)
- **Connection Refused**: Make sure backend server is running
- **Auth Failures**: Check database contains demo users
- **Timeout Issues**: Try the voice debug tool first

## 📊 Expected Results:

### Voice Session Test Should Show:
- ✅ Authentication successful
- ✅ Tools found (should be 2+ tools)
- ✅ Voice session created
- ✅ Session state transitions (initializing → active → completed)
- ✅ Mock data collection for each field
- ✅ Final session completion

### Connection Test Should Show:
- ✅ Backend health check passed
- ✅ Login successful with JWT token
- ✅ Providers API working
- ✅ All tests passed message

## 🔍 Debug Information:

The tools provide detailed logging including:
- Request/response details
- Timing information
- Error messages with suggestions
- Session state changes
- Authentication token status

## 📝 Notes:

- These tools are for development/testing only
- They simulate voice interactions without actual audio
- Real voice features need to be tested in the main React app
- All API calls are made to the same backend server (port 3001)
