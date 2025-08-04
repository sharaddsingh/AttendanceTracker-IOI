import React, { useState } from 'react';
import './login.css';

export default function Login() {
  const [userType, setUserType] = useState('student');
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`${userType === 'student' ? 'Student' : 'Faculty'} login with: ${inputValue}`);
  };

  const handleToggle = (type) => {
    setUserType(type);
    setInputValue('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Attendance Tracker</h2>

        <div className="toggle-buttons">
          <button
            className={userType === 'student' ? 'active' : ''}
            onClick={() => handleToggle('student')}
          >
            Student
          </button>
          <button
            className={userType === 'faculty' ? 'active' : ''}
            onClick={() => handleToggle('faculty')}
          >
            Faculty
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder={
              userType === 'student'
                ? 'Enter Roll Number or Email'
                : 'Enter Faculty Email or ID'
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            required
          />
          <button type="submit" className="submit-btn">Login</button>
        </form>
      </div>
    </div>
  );
}
