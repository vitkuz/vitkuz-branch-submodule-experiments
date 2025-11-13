export type ValidationRule =
  | { type: 'required' }
  | { type: 'minLength'; value: number }
  | { type: 'maxLength'; value: number }
  | { type: 'pattern'; value: RegExp }
  | { type: 'email' }
  | { type: 'min'; value: number }
  | { type: 'max'; value: number }
  | { type: 'custom'; validate: (value: unknown) => boolean; message: string };

export interface ValidationError {
  field: string;
  rule: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface Schema {
  [field: string]: ValidationRule[];
}

export interface Validator {
  validate: (data: Record<string, unknown>, schema: Schema) => ValidationResult;
  addCustomRule: (name: string, validate: (value: unknown) => boolean, message: string) => void;
}

export const createValidator = (): Validator => {
  const customRules: Map<string, { validate: (value: unknown) => boolean; message: string }> = new Map();

  const validateField = (value: unknown, rules: ValidationRule[]): ValidationError[] => {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      switch (rule.type) {
        case 'required':
          if (value === undefined || value === null || value === '') {
            errors.push({
              field: '',
              rule: 'required',
              message: 'This field is required',
            });
          }
          break;

        case 'minLength':
          if (typeof value === 'string' && value.length < rule.value) {
            errors.push({
              field: '',
              rule: 'minLength',
              message: `Minimum length is ${rule.value}`,
            });
          }
          break;

        case 'maxLength':
          if (typeof value === 'string' && value.length > rule.value) {
            errors.push({
              field: '',
              rule: 'maxLength',
              message: `Maximum length is ${rule.value}`,
            });
          }
          break;

        case 'pattern':
          if (typeof value === 'string' && !rule.value.test(value)) {
            errors.push({
              field: '',
              rule: 'pattern',
              message: 'Value does not match required pattern',
            });
          }
          break;

        case 'email':
          const emailPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (typeof value === 'string' && !emailPattern.test(value)) {
            errors.push({
              field: '',
              rule: 'email',
              message: 'Invalid email address',
            });
          }
          break;

        case 'min':
          if (typeof value === 'number' && value < rule.value) {
            errors.push({
              field: '',
              rule: 'min',
              message: `Minimum value is ${rule.value}`,
            });
          }
          break;

        case 'max':
          if (typeof value === 'number' && value > rule.value) {
            errors.push({
              field: '',
              rule: 'max',
              message: `Maximum value is ${rule.value}`,
            });
          }
          break;

        case 'custom':
          if (!rule.validate(value)) {
            errors.push({
              field: '',
              rule: 'custom',
              message: rule.message,
            });
          }
          break;
      }
    }

    return errors;
  };

  return {
    validate: (data: Record<string, unknown>, schema: Schema): ValidationResult => {
      const allErrors: ValidationError[] = [];

      for (const [field, rules] of Object.entries(schema)) {
        const value: unknown = data[field];
        const fieldErrors: ValidationError[] = validateField(value, rules);

        for (const error of fieldErrors) {
          allErrors.push({ ...error, field });
        }
      }

      return {
        valid: allErrors.length === 0,
        errors: allErrors,
      };
    },

    addCustomRule: (name: string, validate: (value: unknown) => boolean, message: string): void => {
      customRules.set(name, { validate, message });
    },
  };
};
