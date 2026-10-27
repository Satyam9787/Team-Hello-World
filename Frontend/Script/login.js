// ==========================================
// MINI PROJECT - LOGIN JAVASCRIPT
// ==========================================

// ------------------------------------------
// Password Show / Hide
// ------------------------------------------

document.querySelectorAll('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
        const targetId = button.dataset.target;
        const passwordInput = document.getElementById(targetId);

        if (!passwordInput) return;

        const isPassword = passwordInput.type === 'password';

        passwordInput.type = isPassword ? 'text' : 'password';

        button.setAttribute(
            'aria-label',
            isPassword ? 'Hide password' : 'Show password'
        );

        // Switch SVG using simple opacity/transform state
        button.classList.toggle('password-visible', isPassword);
    });
});


// ------------------------------------------
// Elements
// ------------------------------------------

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('li-email');
const passwordInput = document.getElementById('li-password');

const emailError = document.getElementById('li-err-email');
const passwordError = document.getElementById('li-err-password');

const loginStatus = document.getElementById('login-status');
const submitButton = document.querySelector('.card-submit');


// ------------------------------------------
// Utility Functions
// ------------------------------------------

function clearErrors() {
    emailError.textContent = '';
    passwordError.textContent = '';

    emailInput.classList.remove('input-error');
    passwordInput.classList.remove('input-error');

    loginStatus.textContent = '';
    loginStatus.className = 'card-status';
}


function showError(field, message) {
    if (field === 'email') {
        emailError.textContent = message;
        emailInput.classList.add('input-error');
    }

    if (field === 'password') {
        passwordError.textContent = message;
        passwordInput.classList.add('input-error');
    }
}


function showStatus(message, type = '') {
    loginStatus.textContent = message;
    loginStatus.className = `card-status ${type}`;
}


// ------------------------------------------
// Login
// ------------------------------------------

async function handleLogin(event) {
    event.preventDefault();

    clearErrors();

    const email = emailInput.value.trim();

    // IMPORTANT:
    // Do NOT trim passwords.
    const password = passwordInput.value;

    // --------------------------------------
    // Frontend Validation
    // --------------------------------------

    if (!email) {
        showError('email', 'Email is required.');
        emailInput.focus();
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        showError('email', 'Please enter a valid email address.');
        emailInput.focus();
        return;
    }

    if (!password) {
        showError('password', 'Password is required.');
        passwordInput.focus();
        return;
    }


    // --------------------------------------
    // Loading State
    // --------------------------------------

    submitButton.disabled = true;
    submitButton.classList.add('loading');
    submitButton.textContent = 'Checking your card…';


    try {

        // ----------------------------------
        // Login API
        // ----------------------------------

        const response = await fetch('/api/login', {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                email: email,
                password: password
            })
        });


        // ----------------------------------
        // Parse Response
        // ----------------------------------

        let result;

        try {
            result = await response.json();
        } catch (jsonError) {
            console.error('Invalid JSON response:', jsonError);

            throw new Error('Invalid server response.');
        }


        console.log('Login response:', result);


        // ----------------------------------
        // OTP Required
        // ----------------------------------

        if (result.status === 'otp_required') {

            // Store email for OTP page
            localStorage.setItem('userEmail', email);

            showStatus(
                'Credentials verified. Sending verification code…',
                'success'
            );

            submitButton.textContent = 'Verification required';


            // --------------------------------
            // Send OTP
            // --------------------------------

            try {

                const otpResponse = await fetch('/send-otp', {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        email: email,
                        usecase: 'LOGIN'
                    })
                });


                let otpResult;

                try {
                    otpResult = await otpResponse.json();
                } catch (jsonError) {
                    console.error(
                        'Invalid OTP response:',
                        jsonError
                    );

                    throw new Error('Invalid OTP server response.');
                }


                console.log('OTP response:', otpResult);


                if (!otpResponse.ok) {
                    throw new Error(
                        otpResult.message ||
                        'Unable to send OTP.'
                    );
                }


                // ----------------------------
                // OTP Successfully Sent
                // ----------------------------

                showStatus(
                    'Verification code sent. Redirecting…',
                    'success'
                );

                setTimeout(() => {
                    window.location.href = '/otp';
                }, 600);

                return;

            } catch (otpError) {

                console.error('OTP Error:', otpError);

                showStatus(
                    'Unable to send verification code. Please try again.',
                    'error'
                );

                submitButton.disabled = false;
                submitButton.classList.remove('loading');
                submitButton.textContent =
                    'Enter the Reading Room';

                return;
            }
        }


        // ----------------------------------
        // Invalid Password
        // ----------------------------------

        if (result.status === 'Invalid_pass') {

            showError(
                'password',
                'Incorrect password.'
            );

            showStatus(
                'Your reader card could not be verified.',
                'error'
            );

            passwordInput.focus();

            return;
        }


        // ----------------------------------
        // Too Many Attempts
        // ----------------------------------

        if (result.status === 'ATTEMPT_LIMIT_EXCEED') {

            showStatus(
                'Too many attempts. Please try again in about 4 minutes.',
                'error'
            );

            return;
        }


        // ----------------------------------
        // User Not Found
        // ----------------------------------

        if (
            result.status === 'USER_NOT_FOUND' ||
            result.status === 'NOT_FOUND'
        ) {

            showError(
                'email',
                'No account found with this email.'
            );

            showStatus(
                'We could not find this reader card.',
                'error'
            );

            emailInput.focus();

            return;
        }


        // ----------------------------------
        // Email Not Verified
        // ----------------------------------

        if (result.status === 'EMAIL_NOT_VERIFIED') {

            localStorage.setItem(
                'userEmail',
                email
            );

            showStatus(
                'Please verify your email first.',
                'error'
            );

            setTimeout(() => {
                window.location.href = '/otp';
            }, 600);

            return;
        }


        // ----------------------------------
        // Generic Backend Error
        // ----------------------------------

        showStatus(
            result.message ||
            'Unable to sign in. Please try again.',
            'error'
        );

    } catch (error) {

        console.error('Login Error:', error);

        showStatus(
            'Unable to connect to the server. Please try again.',
            'error'
        );

    } finally {

        // Don't reset the button if we're already
        // moving to the OTP page.
        if (!window.location.pathname.includes('/otp')) {

            submitButton.disabled = false;
            submitButton.classList.remove('loading');

            submitButton.textContent =
                'Enter the Reading Room';
        }
    }
}


// ------------------------------------------
// Form Submit
// ------------------------------------------

if (loginForm) {
    loginForm.addEventListener(
        'submit',
        handleLogin
    );
}


// ------------------------------------------
// Clear Individual Errors While Typing
// ------------------------------------------

emailInput.addEventListener('input', () => {

    emailError.textContent = '';
    emailInput.classList.remove('input-error');

    if (!emailError.textContent) {
        loginStatus.textContent = '';
        loginStatus.className = 'card-status';
    }
});


passwordInput.addEventListener('input', () => {

    passwordError.textContent = '';
    passwordInput.classList.remove('input-error');

    loginStatus.textContent = '';
    loginStatus.className = 'card-status';
});