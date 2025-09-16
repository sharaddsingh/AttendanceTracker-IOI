# Firebase Storage Setup Instructions

## Issue: Photo Saving Error in Student Dashboard

The photo saving functionality is currently failing because Firebase Storage has not been enabled for this project.

## Solution: Enable Firebase Storage

### Step 1: Enable Firebase Storage
1. Go to [Firebase Console](https://console.firebase.google.com/project/attendancetracker-f8461/storage)
2. Click "Get Started" to enable Firebase Storage
3. Choose a location for your storage bucket (preferably same as Firestore)
4. Click "Done"

### Step 2: Deploy Storage Rules
After enabling Storage in the console, run:
```bash
firebase deploy --only storage
```

### Step 3: Verify Setup
1. Check that the storage bucket is created in the Firebase console
2. Test photo upload functionality in the student dashboard
3. Verify photos are being saved to the `temp_photos/` folder structure

## Alternative: Temporary Fallback Solution

If Storage cannot be enabled immediately, the code will need to be temporarily modified to use a different approach:

1. Reduce photo quality/size significantly
2. Store compressed base64 data in Firestore (with size limits)
3. Display warning to users about photo limitations

## Current Storage Structure

```
storage_bucket/
├── temp_photos/
│   └── {studentId}/
│       └── {date}/
│           └── {subject}_{timestamp}.jpg
├── profile_photos/
│   └── {studentId}/
│       └── profile_{timestamp}.jpg
└── attendance_photos/
    └── {studentId}/
        └── {date}/
            └── {filename}
```

## Security Rules

The `storage.rules` file has been created with appropriate security rules:
- Students can only upload to their own folders
- Faculty can read all photos for verification
- File size limits (5MB for profiles, 10MB for temp photos)
- Only image files are allowed

## Testing

After setup, test the following:
1. Student profile photo upload
2. QR code scanning and photo capture for attendance
3. Faculty photo verification workflow

## Troubleshooting

### Common Issues:
1. **"storage/unauthorized" error**: Check that storage rules are deployed
2. **"storage/quota-exceeded"**: Check storage quota in Firebase console
3. **"storage/unknown" error**: Check internet connection and try again

### Debug Commands:
- Check Firebase project status: `firebase projects:list`
- Deploy only storage rules: `firebase deploy --only storage`
- Check current deployment status: `firebase deploy:status`

## Status: ❌ Storage Not Enabled
**Action Required**: Enable Firebase Storage in the console before photo functionality will work.