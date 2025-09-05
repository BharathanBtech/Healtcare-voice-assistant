/**
 * Validation utilities for healthcare voice agent
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp | string;
  customValidator?: (value: any) => boolean;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Validate a single field value against validation rules
 */
export function validateField(value: any, rules: ValidationRule): ValidationResult {
  // Required check
  if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return { isValid: false, message: rules.message || 'This field is required' };
  }

  // Skip other validations if field is empty and not required
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return { isValid: true };
  }

  const stringValue = typeof value === 'string' ? value : String(value);

  // Length validations
  if (rules.minLength && stringValue.length < rules.minLength) {
    return { 
      isValid: false, 
      message: rules.message || `Must be at least ${rules.minLength} characters long` 
    };
  }

  if (rules.maxLength && stringValue.length > rules.maxLength) {
    return { 
      isValid: false, 
      message: rules.message || `Must be no more than ${rules.maxLength} characters long` 
    };
  }

  // Pattern validation
  if (rules.pattern) {
    const regex = typeof rules.pattern === 'string' ? new RegExp(rules.pattern) : rules.pattern;
    if (!regex.test(stringValue)) {
      return { 
        isValid: false, 
        message: rules.message || 'Invalid format' 
      };
    }
  }

  // Custom validation
  if (rules.customValidator && !rules.customValidator(value)) {
    return { 
      isValid: false, 
      message: rules.message || 'Invalid value' 
    };
  }

  return { isValid: true };
}

/**
 * Validate multiple fields
 */
export function validateFields(
  data: Record<string, any>, 
  validationRules: Record<string, ValidationRule>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  Object.keys(validationRules).forEach(fieldName => {
    const value = data[fieldName];
    const rules = validationRules[fieldName];
    const result = validateField(value, rules);

    if (!result.isValid) {
      errors[fieldName] = result.message || 'Invalid value';
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-\(\)]{10,}$/,
  ssn: /^\d{3}-\d{2}-\d{4}$|^\d{9}$/,
  zipCode: /^\d{5}(-\d{4})?$/,
  url: /^https?:\/\/.+/,
  apiKey: {
    openai: /^sk-[a-zA-Z0-9\-_]{20,}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9\-_]{50,}$/,
    azure: /^[a-f0-9]{32,}$/
  },
  awsAccessKey: /^AKIA[0-9A-Z]{16}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  time: /^\d{2}:\d{2}$/,
  dateTime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
};

/**
 * Healthcare-specific validation rules
 */
export const HealthcareValidationRules = {
  patientId: {
    required: true,
    pattern: /^[A-Z0-9]{6,12}$/,
    message: 'Patient ID must be 6-12 alphanumeric characters'
  },
  
  medicalRecordNumber: {
    required: true,
    pattern: /^[A-Z0-9\-]{8,15}$/,
    message: 'Medical record number must be 8-15 characters'
  },
  
  insuranceNumber: {
    required: true,
    minLength: 9,
    maxLength: 20,
    message: 'Insurance number must be 9-20 characters'
  },
  
  dateOfBirth: {
    required: true,
    pattern: ValidationPatterns.date,
    customValidator: (value: string) => {
      const date = new Date(value);
      const now = new Date();
      const age = now.getFullYear() - date.getFullYear();
      return age >= 0 && age <= 150;
    },
    message: 'Please enter a valid date of birth'
  },
  
  phoneNumber: {
    required: true,
    pattern: ValidationPatterns.phone,
    message: 'Please enter a valid phone number'
  },
  
  email: {
    pattern: ValidationPatterns.email,
    message: 'Please enter a valid email address'
  },
  
  zipCode: {
    pattern: ValidationPatterns.zipCode,
    message: 'Please enter a valid ZIP code'
  },

  ssn: {
    pattern: ValidationPatterns.ssn,
    message: 'Please enter a valid SSN (XXX-XX-XXXX)'
  }
};

/**
 * Provider-specific validation rules
 */
export const ProviderValidationRules = {
  openaiApiKey: {
    required: true,
    pattern: ValidationPatterns.apiKey.openai,
    message: 'OpenAI API key must start with "sk-" and be at least 20 characters long'
  },

  anthropicApiKey: {
    required: true,
    pattern: ValidationPatterns.apiKey.anthropic,
    message: 'Anthropic API key must start with "sk-ant-"'
  },

  azureApiKey: {
    required: true,
    minLength: 32,
    maxLength: 32,
    pattern: ValidationPatterns.apiKey.azure,
    message: 'Azure API key must be a 32-character hexadecimal string'
  },

  azureEndpoint: {
    required: true,
    pattern: /^https:\/\/[\w\-\.]+\.openai\.azure\.com\/?$/,
    message: 'Azure endpoint must be a valid Azure OpenAI endpoint URL'
  },

  awsAccessKeyId: {
    required: true,
    pattern: ValidationPatterns.awsAccessKey,
    message: 'AWS Access Key ID must start with "AKIA" followed by 16 characters'
  },

  awsSecretAccessKey: {
    required: true,
    minLength: 40,
    maxLength: 40,
    message: 'AWS Secret Access Key must be 40 characters long'
  },

  googleProjectId: {
    required: true,
    pattern: /^[a-z][a-z0-9\-]{4,28}[a-z0-9]$/,
    message: 'Google Project ID must be 6-30 characters, lowercase letters, numbers, and hyphens'
  }
};

/**
 * Sanitize input values
 */
export function sanitizeInput(value: string): string {
  if (typeof value !== 'string') return '';
  
  return value
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length to prevent abuse
}

/**
 * Validate and sanitize healthcare form data
 */
export function validateHealthcareForm(
  data: Record<string, any>
): { isValid: boolean; errors: Record<string, string>; sanitizedData: Record<string, any> } {
  const sanitizedData: Record<string, any> = {};
  const errors: Record<string, string> = {};

  // Sanitize all string values
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (typeof value === 'string') {
      sanitizedData[key] = sanitizeInput(value);
    } else {
      sanitizedData[key] = value;
    }
  });

  // Apply healthcare-specific validations based on field names
  Object.keys(sanitizedData).forEach(fieldName => {
    const value = sanitizedData[fieldName];
    let rules: ValidationRule | undefined;

    // Map field names to validation rules
    switch (fieldName.toLowerCase()) {
      case 'patientid':
      case 'patient_id':
        rules = HealthcareValidationRules.patientId;
        break;
      case 'medicalrecordnumber':
      case 'medical_record_number':
      case 'mrn':
        rules = HealthcareValidationRules.medicalRecordNumber;
        break;
      case 'insurancenumber':
      case 'insurance_number':
        rules = HealthcareValidationRules.insuranceNumber;
        break;
      case 'dateofbirth':
      case 'date_of_birth':
      case 'dob':
        rules = HealthcareValidationRules.dateOfBirth;
        break;
      case 'phonenumber':
      case 'phone_number':
      case 'phone':
        rules = HealthcareValidationRules.phoneNumber;
        break;
      case 'email':
      case 'emailaddress':
      case 'email_address':
        rules = HealthcareValidationRules.email;
        break;
      case 'zipcode':
      case 'zip_code':
      case 'postalcode':
      case 'postal_code':
        rules = HealthcareValidationRules.zipCode;
        break;
      case 'ssn':
      case 'socialsecuritynumber':
      case 'social_security_number':
        rules = HealthcareValidationRules.ssn;
        break;
    }

    if (rules) {
      const result = validateField(value, rules);
      if (!result.isValid) {
        errors[fieldName] = result.message || 'Invalid value';
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData
  };
}

/**
 * Real-time field validation for forms
 */
export class FieldValidator {
  private rules: Record<string, ValidationRule>;
  private errors: Record<string, string> = {};

  constructor(validationRules: Record<string, ValidationRule>) {
    this.rules = validationRules;
  }

  validateField(fieldName: string, value: any): ValidationResult {
    const rules = this.rules[fieldName];
    if (!rules) {
      return { isValid: true };
    }

    const result = validateField(value, rules);
    
    if (result.isValid) {
      delete this.errors[fieldName];
    } else {
      this.errors[fieldName] = result.message || 'Invalid value';
    }

    return result;
  }

  validateAll(data: Record<string, any>): { isValid: boolean; errors: Record<string, string> } {
    this.errors = {};
    
    Object.keys(this.rules).forEach(fieldName => {
      this.validateField(fieldName, data[fieldName]);
    });

    return {
      isValid: Object.keys(this.errors).length === 0,
      errors: { ...this.errors }
    };
  }

  getErrors(): Record<string, string> {
    return { ...this.errors };
  }

  hasError(fieldName: string): boolean {
    return fieldName in this.errors;
  }

  getError(fieldName: string): string | undefined {
    return this.errors[fieldName];
  }

  clearErrors(): void {
    this.errors = {};
  }

  clearError(fieldName: string): void {
    delete this.errors[fieldName];
  }
}
