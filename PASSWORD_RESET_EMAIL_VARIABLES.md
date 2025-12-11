# Password Reset Email Template Variables

## Template Configuration
- **Template ID**: `template_39qjb27`
- **Service ID**: `service_80s1dny`
- **Public Key**: `WVh8o7pHWLGBMVK_K`

## Variables Being Sent

When `sendPasswordResetEmail(email, code)` is called, the following variables are sent to EmailJS:

```javascript
const templateParams = {
    to_email: email,           // The recipient's email address
    reset_code: code,          // The 6-digit password reset code
    code: code,                // Also sent as 'code' (backup variable name)
    from_name: 'RNG Calendar'  // Sender name
};
```

## EmailJS Template Setup

In your EmailJS template (`template_39qjb27`), you should use these variables:

### Required Variables:

1. **To Email Field** (in EmailJS template settings):
   - Use: `{{to_email}}`
   - This is where the email will be sent

2. **Reset Code** (in email body):
   - Use: `{{reset_code}}` OR `{{code}}`
   - Both variable names are sent, so either will work
   - This is the 6-digit code the user needs to enter

### Optional Variables:

3. **From Name**:
   - Use: `{{from_name}}`
   - Value: "RNG Calendar"
   - Can be used in email signature or greeting

## Example Email Template Content

```
Subject: Reset Your Password - RNG Calendar

Hello,

You requested to reset your password for your RNG Calendar account.

Your password reset code is: {{reset_code}}

Enter this code in the password reset form to create a new password.

This code will expire in 30 minutes.

If you didn't request this password reset, please ignore this email.

Best regards,
{{from_name}}
```

## Variable Mapping Summary

| Variable Name | Value | Usage in Template |
|--------------|-------|-------------------|
| `{{to_email}}` | User's email address | EmailJS "To Email" field |
| `{{reset_code}}` | 6-digit code (e.g., "123456") | Email body - primary |
| `{{code}}` | 6-digit code (e.g., "123456") | Email body - backup |
| `{{from_name}}` | "RNG Calendar" | Email body - optional |

## Important Notes

1. **To Email Field**: In EmailJS template settings, set the "To Email" field to `{{to_email}}`
2. **Code Variable**: You can use either `{{reset_code}}` or `{{code}}` in your template - both contain the same value
3. **Code Format**: The code is always a 6-digit number (e.g., "123456", "789012")
4. **Email Format**: The email is always normalized to lowercase before being sent

## Troubleshooting

If emails aren't being sent:
1. Check that `{{to_email}}` is set in the EmailJS template's "To Email" field
2. Verify the template ID is correct: `template_39qjb27`
3. Check browser console for EmailJS errors
4. Verify the EmailJS service is active and configured correctly

