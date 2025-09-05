import { Tool, ToolField, IntermediatePrompt, DataHandoffConfig, ApiResponse } from '@/types';
import { StorageService } from './StorageService';
import { EncryptionService } from './EncryptionService';
import { v4 as uuidv4 } from 'uuid';
import { validateField, ValidationRule, HealthcareValidationRules } from '@/validations';

export interface ToolTemplate {
  id: string;
  name: string;
  description: string;
  category: 'patient-registration' | 'claims-intake' | 'appointment-scheduling' | 'medical-history' | 'custom';
  icon: string;
  fields: Partial<ToolField>[];
  initialPrompt: string;
  conclusionPrompt: string;
}

export class ToolService {
  /**
   * Predefined tool templates for quick setup
   */
  static readonly TOOL_TEMPLATES: ToolTemplate[] = [
    {
      id: 'patient-registration',
      name: 'Patient Registration',
      description: 'Collect new patient information including demographics and insurance details',
      category: 'patient-registration',
      icon: '👤',
      initialPrompt: 'Hello! I\'m here to help you register as a new patient. I\'ll collect some basic information from you. Let\'s start with your full name.',
      conclusionPrompt: 'Thank you for providing your information. Your patient registration is now complete. You should receive a confirmation shortly.',
      fields: [
        {
          name: 'firstName',
          type: 'text',
          required: true,
          instructionalPrompt: 'Please tell me your first name.'
        },
        {
          name: 'lastName',
          type: 'text',
          required: true,
          instructionalPrompt: 'What is your last name?'
        },
        {
          name: 'dateOfBirth',
          type: 'date',
          required: true,
          instructionalPrompt: 'What is your date of birth? Please say it in the format month, day, year.'
        },
        {
          name: 'phoneNumber',
          type: 'phone',
          required: true,
          instructionalPrompt: 'Please provide your phone number including area code.'
        },
        {
          name: 'email',
          type: 'email',
          required: false,
          instructionalPrompt: 'What is your email address? This is optional but helpful for appointment reminders.'
        },
        {
          name: 'insuranceProvider',
          type: 'text',
          required: true,
          instructionalPrompt: 'What is your insurance provider or company name?'
        },
        {
          name: 'insuranceNumber',
          type: 'text',
          required: true,
          instructionalPrompt: 'Please provide your insurance member ID or policy number.'
        }
      ]
    },
    {
      id: 'claims-intake',
      name: 'Insurance Claims Intake',
      description: 'Process insurance claims with patient and incident information',
      category: 'claims-intake',
      icon: '📋',
      initialPrompt: 'I\'ll help you file your insurance claim. Please have your insurance card and incident details ready.',
      conclusionPrompt: 'Your claim has been recorded. You\'ll receive a claim number via email within 24 hours.',
      fields: [
        {
          name: 'claimantName',
          type: 'text',
          required: true,
          instructionalPrompt: 'What is the full name of the person filing this claim?'
        },
        {
          name: 'policyNumber',
          type: 'text',
          required: true,
          instructionalPrompt: 'Please provide your policy or member ID number.'
        },
        {
          name: 'incidentDate',
          type: 'date',
          required: true,
          instructionalPrompt: 'When did the incident or medical service occur?'
        },
        {
          name: 'serviceProvider',
          type: 'text',
          required: true,
          instructionalPrompt: 'Which healthcare provider or facility provided the service?'
        },
        {
          name: 'serviceDescription',
          type: 'text',
          required: true,
          instructionalPrompt: 'Please describe the medical service or treatment received.'
        },
        {
          name: 'totalAmount',
          type: 'number',
          required: true,
          instructionalPrompt: 'What is the total amount being claimed?'
        }
      ]
    },
    {
      id: 'appointment-scheduling',
      name: 'Appointment Scheduling',
      description: 'Schedule medical appointments with preferred dates and times',
      category: 'appointment-scheduling',
      icon: '📅',
      initialPrompt: 'I\'ll help you schedule an appointment. Let me gather some information about your preferred time and the type of appointment needed.',
      conclusionPrompt: 'Your appointment request has been submitted. Our scheduling team will contact you within one business day to confirm.',
      fields: [
        {
          name: 'patientName',
          type: 'text',
          required: true,
          instructionalPrompt: 'What is the patient\'s full name for this appointment?'
        },
        {
          name: 'appointmentType',
          type: 'select',
          required: true,
          instructionalPrompt: 'What type of appointment do you need?',
          options: ['General Consultation', 'Follow-up', 'Specialist Referral', 'Diagnostic Test', 'Emergency']
        },
        {
          name: 'preferredDate',
          type: 'date',
          required: true,
          instructionalPrompt: 'What is your preferred date for the appointment?'
        },
        {
          name: 'preferredTime',
          type: 'select',
          required: true,
          instructionalPrompt: 'What time of day works best for you?',
          options: ['Morning (8 AM - 12 PM)', 'Afternoon (12 PM - 5 PM)', 'Evening (5 PM - 8 PM)', 'Any time']
        },
        {
          name: 'reasonForVisit',
          type: 'text',
          required: true,
          instructionalPrompt: 'Please briefly describe the reason for this appointment.'
        }
      ]
    },
    {
      id: 'medical-history',
      name: 'Medical History Intake',
      description: 'Collect comprehensive medical history information',
      category: 'medical-history',
      icon: '🏥',
      initialPrompt: 'I\'ll collect your medical history information. This helps ensure you receive the best possible care.',
      conclusionPrompt: 'Thank you for providing your medical history. This information will be reviewed by your healthcare provider.',
      fields: [
        {
          name: 'patientName',
          type: 'text',
          required: true,
          instructionalPrompt: 'Please state your full name.'
        },
        {
          name: 'allergies',
          type: 'text',
          required: false,
          instructionalPrompt: 'Do you have any known allergies to medications, foods, or other substances?'
        },
        {
          name: 'currentMedications',
          type: 'text',
          required: false,
          instructionalPrompt: 'Please list any medications you are currently taking.'
        },
        {
          name: 'previousSurgeries',
          type: 'text',
          required: false,
          instructionalPrompt: 'Have you had any surgeries or major medical procedures?'
        },
        {
          name: 'familyHistory',
          type: 'text',
          required: false,
          instructionalPrompt: 'Do you have any significant family medical history we should know about?'
        },
        {
          name: 'currentSymptoms',
          type: 'text',
          required: true,
          instructionalPrompt: 'Please describe your current symptoms or the reason for your visit.'
        }
      ]
    }
  ];

  /**
   * Get all tool templates
   */
  static getToolTemplates(): ToolTemplate[] {
    return this.TOOL_TEMPLATES;
  }

  /**
   * Get a specific tool template
   */
  static getToolTemplate(templateId: string): ToolTemplate | null {
    return this.TOOL_TEMPLATES.find(template => template.id === templateId) || null;
  }

  /**
   * Create a new tool from scratch
   */
  static createTool(toolData: Partial<Tool>): Tool {
    const now = new Date();
    
    const tool: Tool = {
      id: toolData.id || EncryptionService.generateSecureUUID(),
      name: toolData.name || 'Untitled Tool',
      description: toolData.description || '',
      initialPrompt: toolData.initialPrompt || 'Hello! I\'m here to help you with this process.',
      conclusionPrompt: toolData.conclusionPrompt || 'Thank you! Your information has been recorded.',
      intermediatePrompts: toolData.intermediatePrompts || [],
      fields: toolData.fields || [],
      dataHandoff: toolData.dataHandoff || {
        type: 'api',
        api: {
          endpoint: '',
          method: 'POST',
          headers: {},
          payloadStructure: {}
        }
      },
      createdAt: toolData.createdAt || now,
      updatedAt: now
    };

    return tool;
  }

  /**
   * Create a tool from a template
   */
  static createToolFromTemplate(templateId: string, customizations?: Partial<Tool>): Tool | null {
    const template = this.getToolTemplate(templateId);
    if (!template) {
      return null;
    }

    // Convert template fields to full ToolField objects
    const fields: ToolField[] = template.fields.map((field, index) => ({
      id: EncryptionService.generateSecureUUID(),
      name: field.name || `field_${index}`,
      required: field.required || false,
      type: field.type || 'text',
      validation: {
        clientSide: this.getDefaultValidation(field.type || 'text', field.required || false)
      },
      instructionalPrompt: field.instructionalPrompt || `Please provide ${field.name}`,
      options: field.options
    }));

    const toolData = {
      name: template.name,
      description: template.description,
      initialPrompt: template.initialPrompt,
      conclusionPrompt: template.conclusionPrompt,
      fields,
      ...customizations
    };

    return this.createTool(toolData);
  }

  /**
   * Get default validation rules for a field type
   */
  private static getDefaultValidation(fieldType: string, required: boolean): any {
    const baseValidation = { required };

    switch (fieldType) {
      case 'email':
        return {
          ...baseValidation,
          format: 'email'
        };
      case 'phone':
        return {
          ...baseValidation,
          format: 'phone'
        };
      case 'ssn':
        return {
          ...baseValidation,
          format: 'ssn'
        };
      case 'date':
        return {
          ...baseValidation,
          format: 'date'
        };
      case 'text':
        return {
          ...baseValidation,
          minLength: required ? 1 : 0,
          maxLength: 500
        };
      case 'number':
        return {
          ...baseValidation
        };
      default:
        return baseValidation;
    }
  }

  /**
   * Validate a tool configuration
   */
  static validateTool(tool: Partial<Tool>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!tool.name || tool.name.trim() === '') {
      errors.push('Tool name is required');
    }

    if (!tool.description || tool.description.trim() === '') {
      errors.push('Tool description is required');
    }

    if (!tool.initialPrompt || tool.initialPrompt.trim() === '') {
      errors.push('Initial prompt is required');
    }

    if (!tool.conclusionPrompt || tool.conclusionPrompt.trim() === '') {
      errors.push('Conclusion prompt is required');
    }

    // Field validation
    if (!tool.fields || tool.fields.length === 0) {
      errors.push('At least one field is required');
    } else {
      tool.fields.forEach((field, index) => {
        if (!field.name || field.name.trim() === '') {
          errors.push(`Field ${index + 1}: Name is required`);
        }

        if (!field.instructionalPrompt || field.instructionalPrompt.trim() === '') {
          errors.push(`Field ${index + 1}: Instructional prompt is required`);
        }

        if (field.type === 'select' && (!field.options || field.options.length === 0)) {
          errors.push(`Field ${index + 1}: Select fields must have options`);
        }
      });
    }

    // Data handoff validation
    if (tool.dataHandoff) {
      if (tool.dataHandoff.type === 'api' && tool.dataHandoff.api) {
        if (!tool.dataHandoff.api.endpoint) {
          errors.push('API endpoint is required for API data handoff');
        }
      } else if (tool.dataHandoff.type === 'database' && tool.dataHandoff.database) {
        if (!tool.dataHandoff.database.hostname) {
          errors.push('Database hostname is required for database data handoff');
        }
        if (!tool.dataHandoff.database.database) {
          errors.push('Database name is required for database data handoff');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Save a tool
   */
  static async saveTool(tool: Tool): Promise<ApiResponse<Tool>> {
    try {
      const validation = this.validateTool(tool);
      
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // Update the updatedAt timestamp
      tool.updatedAt = new Date();

      // Save to storage
      StorageService.saveTool(tool);

      return {
        success: true,
        data: tool,
        message: 'Tool saved successfully'
      };
    } catch (error) {
      console.error('Error saving tool:', error);
      return {
        success: false,
        error: 'Failed to save tool'
      };
    }
  }

  /**
   * Load a tool by ID
   */
  static loadTool(toolId: string): Tool | null {
    return StorageService.getTool(toolId);
  }

  /**
   * Load all tools
   */
  static loadAllTools(): Tool[] {
    return StorageService.getTools();
  }

  /**
   * Delete a tool
   */
  static async deleteTool(toolId: string): Promise<ApiResponse<boolean>> {
    try {
      StorageService.deleteTool(toolId);
      return {
        success: true,
        data: true,
        message: 'Tool deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting tool:', error);
      return {
        success: false,
        error: 'Failed to delete tool'
      };
    }
  }

  /**
   * Duplicate a tool
   */
  static duplicateTool(toolId: string, newName?: string): Tool | null {
    const originalTool = this.loadTool(toolId);
    if (!originalTool) {
      return null;
    }

    const duplicatedTool = {
      ...originalTool,
      id: EncryptionService.generateSecureUUID(),
      name: newName || `${originalTool.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Generate new IDs for all fields
      fields: originalTool.fields.map(field => ({
        ...field,
        id: EncryptionService.generateSecureUUID()
      })),
      // Generate new IDs for intermediate prompts
      intermediatePrompts: originalTool.intermediatePrompts?.map(prompt => ({
        ...prompt,
        id: EncryptionService.generateSecureUUID()
      }))
    };

    return duplicatedTool;
  }

  /**
   * Export tool configuration
   */
  static exportTool(toolId: string): string | null {
    const tool = this.loadTool(toolId);
    if (!tool) {
      return null;
    }

    const exportData = {
      tool,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import tool configuration
   */
  static importTool(jsonData: string): Tool | null {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.tool) {
        throw new Error('Invalid tool data');
      }

      const tool = importData.tool;
      
      // Generate new IDs to avoid conflicts
      tool.id = EncryptionService.generateSecureUUID();
      tool.name = `${tool.name} (Imported)`;
      tool.createdAt = new Date();
      tool.updatedAt = new Date();

      // Generate new field IDs
      if (tool.fields) {
        tool.fields = tool.fields.map((field: any) => ({
          ...field,
          id: EncryptionService.generateSecureUUID()
        }));
      }

      // Generate new intermediate prompt IDs
      if (tool.intermediatePrompts) {
        tool.intermediatePrompts = tool.intermediatePrompts.map((prompt: any) => ({
          ...prompt,
          id: EncryptionService.generateSecureUUID()
        }));
      }

      return tool;
    } catch (error) {
      console.error('Error importing tool:', error);
      return null;
    }
  }

  /**
   * Generate field validation rules
   */
  static generateFieldValidationRules(fields: ToolField[]): Record<string, ValidationRule> {
    const rules: Record<string, ValidationRule> = {};

    fields.forEach(field => {
      const fieldRules: ValidationRule = {
        required: field.required
      };

      // Add type-specific validation
      switch (field.type) {
        case 'email':
          fieldRules.pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          fieldRules.message = 'Please enter a valid email address';
          break;
        case 'phone':
          fieldRules.pattern = /^\+?[\d\s\-\(\)]{10,}$/;
          fieldRules.message = 'Please enter a valid phone number';
          break;
        case 'ssn':
          fieldRules.pattern = /^\d{3}-\d{2}-\d{4}$|^\d{9}$/;
          fieldRules.message = 'Please enter a valid SSN';
          break;
        case 'date':
          fieldRules.pattern = /^\d{4}-\d{2}-\d{2}$/;
          fieldRules.message = 'Please enter a valid date (YYYY-MM-DD)';
          break;
        case 'text':
          if (field.validation?.clientSide?.minLength) {
            fieldRules.minLength = field.validation.clientSide.minLength;
          }
          if (field.validation?.clientSide?.maxLength) {
            fieldRules.maxLength = field.validation.clientSide.maxLength;
          }
          break;
      }

      // Add custom validation if specified
      if (field.validation?.clientSide?.regex) {
        fieldRules.pattern = new RegExp(field.validation.clientSide.regex);
      }

      rules[field.name] = fieldRules;
    });

    return rules;
  }

  /**
   * Test tool configuration
   */
  static testTool(tool: Tool): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Test field configurations
    tool.fields.forEach((field, index) => {
      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        issues.push(`Field "${field.name}": Select type requires options`);
      }

      if (field.validation?.clientSide?.regex) {
        try {
          new RegExp(field.validation.clientSide.regex);
        } catch (error) {
          issues.push(`Field "${field.name}": Invalid regex pattern`);
        }
      }
    });

    // Test data handoff configuration
    if (tool.dataHandoff.type === 'api' && tool.dataHandoff.api) {
      try {
        new URL(tool.dataHandoff.api.endpoint);
      } catch (error) {
        issues.push('Invalid API endpoint URL');
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}
