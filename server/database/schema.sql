-- Healthcare Voice Agent Platform Database Schema
-- PostgreSQL Database Schema for persistent data storage

-- Users table for authentication and user management
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    organization_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider configurations table
CREATE TABLE IF NOT EXISTS provider_configs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_type VARCHAR(20) NOT NULL, -- 'stt', 'llm', 'tts'
    provider_name VARCHAR(50) NOT NULL, -- 'openai', 'azure', 'google', etc.
    encrypted_credentials TEXT NOT NULL, -- Encrypted JSON string
    configuration JSONB DEFAULT '{}', -- Provider-specific config
    is_active BOOLEAN DEFAULT true,
    last_tested TIMESTAMP,
    test_status VARCHAR(20), -- 'success', 'failed', 'pending'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider_type, provider_name)
);

-- Tools table for voice interaction tools
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_id VARCHAR(100), -- Reference to template used
    initial_prompt TEXT NOT NULL,
    conclusion_prompt TEXT NOT NULL,
    intermediate_prompts JSONB DEFAULT '[]', -- Array of intermediate prompts
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tool fields table for field configurations
CREATE TABLE IF NOT EXISTS tool_fields (
    id UUID PRIMARY KEY,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL, -- 'text', 'number', 'email', etc.
    is_required BOOLEAN DEFAULT false,
    instructional_prompt TEXT,
    field_options JSONB DEFAULT '[]', -- For select type fields
    validation_rules JSONB DEFAULT '{}', -- Client and server validation
    field_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data handoff configurations
CREATE TABLE IF NOT EXISTS data_handoff_configs (
    id UUID PRIMARY KEY,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    handoff_type VARCHAR(20) NOT NULL, -- 'api' or 'database'
    api_config JSONB, -- API configuration JSON
    database_config JSONB, -- Database configuration JSON
    field_mappings JSONB DEFAULT '[]', -- Field mapping configurations
    is_active BOOLEAN DEFAULT true,
    last_tested TIMESTAMP,
    test_status VARCHAR(20), -- 'success', 'failed', 'pending'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tool_id)
);

-- Voice sessions table for session tracking
CREATE TABLE IF NOT EXISTS voice_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    session_state VARCHAR(20) NOT NULL DEFAULT 'initializing',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    collected_data JSONB DEFAULT '{}', -- Collected field data
    field_statuses JSONB DEFAULT '{}', -- Status of each field
    transcript JSONB DEFAULT '[]', -- Conversation transcript
    summary TEXT,
    error_log JSONB DEFAULT '[]', -- Error tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Application settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, setting_key)
);

-- Audit log table for tracking changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.
    entity_type VARCHAR(50) NOT NULL, -- 'tool', 'user', 'session', etc.
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_provider_configs_user_id ON provider_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_configs_type ON provider_configs(provider_type);
CREATE INDEX IF NOT EXISTS idx_tools_user_id ON tools(user_id);
CREATE INDEX IF NOT EXISTS idx_tools_active ON tools(is_active);
CREATE INDEX IF NOT EXISTS idx_tool_fields_tool_id ON tool_fields(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_fields_order ON tool_fields(field_order);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_tool_id ON voice_sessions(tool_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_state ON voice_sessions(session_state);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_user_id ON app_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_configs_updated_at BEFORE UPDATE ON provider_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_fields_updated_at BEFORE UPDATE ON tool_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_handoff_configs_updated_at BEFORE UPDATE ON data_handoff_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voice_sessions_updated_at BEFORE UPDATE ON voice_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Default admin user will be inserted by migration script

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts for authentication and authorization';
COMMENT ON TABLE provider_configs IS 'AI provider configurations (STT, LLM, TTS)';
COMMENT ON TABLE tools IS 'Voice interaction tools created by users';
COMMENT ON TABLE tool_fields IS 'Individual fields within voice interaction tools';
COMMENT ON TABLE data_handoff_configs IS 'Data integration configurations for tools';
COMMENT ON TABLE voice_sessions IS 'Active and completed voice interaction sessions';
COMMENT ON TABLE user_sessions IS 'User authentication sessions';
COMMENT ON TABLE app_settings IS 'User-specific application settings';
COMMENT ON TABLE audit_logs IS 'Audit trail for security and compliance';
