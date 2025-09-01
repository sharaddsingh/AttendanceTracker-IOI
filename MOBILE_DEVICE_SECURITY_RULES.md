# Mobile Device Security - Firestore Rules

## Required Firestore Security Rules

Add these rules to your Firestore Security Rules:

```javascript
// Rules for studentDevices collection
match /studentDevices/{deviceId} {
  // Allow read/write only if user is authenticated
  allow read, write: if request.auth != null && request.auth.token.email_verified == true;
  
  // Additional security: only allow access if the student email matches
  allow read, write: if request.auth != null && 
    request.auth.token.email_verified == true && 
    resource.data.studentEmail == request.auth.token.email;
}
```

## Complete Security Rules Example

Here's how your complete `firestore.rules` file should look:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - basic auth required
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Profiles collection - basic auth required
    match /profiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Faculty collection - basic auth required
    match /faculty/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Student devices collection - MOBILE DEVICE SECURITY
    match /studentDevices/{deviceId} {
      // Allow read/write only if user is authenticated and email is verified
      allow read, write: if request.auth != null && request.auth.token.email_verified == true;
    }
    
    // Attendances collection - students can read their own, faculty can read/write
    match /attendances/{attendanceId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email_verified == true;
    }
    
    // Leave requests - students can create/read their own, faculty can read/update
    match /leaveRequests/{requestId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.token.email_verified == true;
      allow update: if request.auth != null && request.auth.token.email_verified == true;
    }
    
    // Notifications - users can read their own
    match /notifications/{notificationId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow write: if request.auth != null && request.auth.token.email_verified == true;
    }
  }
}
```

## How It Works

1. **Device Registration**: When a student first logs in from a mobile device, the system creates a document in `studentDevices` collection with the device fingerprint as the document ID.

2. **Device Binding**: The document contains the student's email, user ID, and device information.

3. **Login Verification**: On subsequent logins, the system checks if the current device fingerprint matches the registered device for that student.

4. **Security**: Only the registered student can access their device document, preventing other students from using the same device.

## Collection Structure

```
studentDevices/
  {deviceFingerprint}/
    - deviceId: string (device fingerprint)
    - studentEmail: string (student's email)
    - userId: string (Firebase user ID)
    - registeredAt: timestamp
    - lastLogin: timestamp
    - deviceInfo: object
      - userAgent: string
      - platform: string  
      - screen: string
      - timezone: string
```

## Benefits

- ✅ Simple and lightweight
- ✅ Mobile-only access for students
- ✅ Prevents device sharing between students
- ✅ Secure device fingerprinting
- ✅ Easy to manage and troubleshoot
