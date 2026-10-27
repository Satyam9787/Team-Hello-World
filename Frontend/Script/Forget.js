const recoveryForm =
    document.getElementById("recoveryForm");

const emailInput =
    document.getElementById("email");

const emailError =
    document.getElementById("emailError");

const recoveryStatus =
    document.getElementById("recoveryStatus");

const submitBtn =
    document.getElementById("submitBtn");

const btnText =
    document.getElementById("btnText");


// ------------------------------------------
// Configuration
// ------------------------------------------

const FORGET_PASSWORD_USECASE =
    "FORGET_PASSWORD";


// ------------------------------------------
// UI Helpers
// ------------------------------------------

function clearMessages() {

    emailError.textContent = "";

    emailInput.classList.remove(
        "input-error",
        "input-success"
    );

    recoveryStatus.textContent = "";

    recoveryStatus.className = "status";

}


function showEmailError(message) {

    emailError.textContent = message;

    emailInput.classList.add("input-error");

}


function showStatus(message, type = "") {

    recoveryStatus.textContent = message;

    recoveryStatus.className =
        type ? `status ${type}` : "status";

}


// ------------------------------------------
// Loading State
// ------------------------------------------

function setLoading(isLoading) {

    if (isLoading) {

        submitBtn.disabled = true;

        submitBtn.classList.add("loading");

        btnText.textContent =
            "Checking your email…";

        emailInput.disabled = true;

    } else {

        submitBtn.disabled = false;

        submitBtn.classList.remove("loading");

        btnText.textContent =
            "Send verification code";

        emailInput.disabled = false;

    }

}


// ==========================================
// FORM SUBMIT
// ==========================================

recoveryForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        clearMessages();


        // ----------------------------------
        // Read email
        // ----------------------------------

        const email =
            emailInput.value.trim();


        // ----------------------------------
        // Validation
        // ----------------------------------

        if (!email) {

            showEmailError(
                "Please enter your email address."
            );

            emailInput.focus();

            return;

        }


        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (!emailPattern.test(email)) {

            showEmailError(
                "Please enter a valid email address."
            );

            emailInput.focus();

            return;

        }


        // ----------------------------------
        // Loading
        // ----------------------------------

        setLoading(true);


        try {

            // ==================================
            // FORGOT PASSWORD API
            // ==================================

            const response =
                await fetch(
                    "/api/forget",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            email: email
                        })
                    }
                );


            let data;


            try {

                data =
                    await response.json();

            } catch (jsonError) {

                console.error(
                    "Invalid recovery response:",
                    jsonError
                );

                throw new Error(
                    "Invalid server response."
                );

            }


            console.log(
                "Recovery response:",
                data
            );


            // ==================================
            // OTP REQUIRED
            // ==================================

            if (
                response.ok &&
                data.status === "otp_required"
            ) {

                // Store email for OTP page
                localStorage.setItem(
                    "userEmail",
                    email
                );


                // IMPORTANT:
                // OTP page needs to know that
                // this OTP is for password recovery.
                sessionStorage.setItem(
                    "usecase",
                    FORGET_PASSWORD_USECASE
                );


                // ==================================
                // SEND OTP
                // ==================================

                btnText.textContent =
                    "Sending verification code…";


                const otpResponse =
                    await fetch(
                        "/send-otp",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                email: email,
                                usecase:
                                    FORGET_PASSWORD_USECASE
                            })
                        }
                    );


                let otpResult;


                try {

                    otpResult =
                        await otpResponse.json();

                } catch (jsonError) {

                    console.error(
                        "Invalid OTP response:",
                        jsonError
                    );

                    throw new Error(
                        "Invalid OTP server response."
                    );

                }


                console.log(
                    "OTP response:",
                    otpResult
                );


                // ==================================
                // OTP SUCCESS
                // ==================================

                if (
                    otpResponse.ok &&
                    otpResult.success
                ) {

                    // First OTP has already been sent.
                    sessionStorage.setItem(
                        "peersprint_otp_send_count",
                        "1"
                    );

                    sessionStorage.setItem(
                        "peersprint_otp_last_send_time",
                        String(Date.now())
                    );


                    emailInput.classList.add(
                        "input-success"
                    );


                    submitBtn.classList.add(
                        "success"
                    );


                    btnText.textContent =
                        "Verification code sent";


                    showStatus(
                        "Code sent. Redirecting to verification…",
                        "success"
                    );


                    setTimeout(() => {

                        window.location.href =
                            "/otp";

                    }, 650);


                    return;

                }


                // ==================================
                // OTP SEND FAILED
                // ==================================

                throw new Error(
                    otpResult.message ||
                    "Unable to send verification code."
                );

            }


            // ==================================
            // EMAIL / ACCOUNT ERROR
            // ==================================

            showStatus(
                data.message ||
                "We couldn't start the password reset.",
                "error"
            );


            emailInput.classList.add(
                "input-error"
            );


        } catch (error) {

            console.error(
                "Password reset request failed:",
                error
            );


            showStatus(
                error.message ===
                    "Invalid server response." ||
                error.message ===
                    "Invalid OTP server response."
                    ? error.message
                    : "Unable to connect to the server. Please try again.",
                "error"
            );


            emailInput.classList.add(
                "input-error"
            );


        } finally {

            // If navigation hasn't started,
            // restore the form.
            if (
                !window.location.pathname.includes(
                    "/otp"
                )
            ) {

                setLoading(false);

            }

        }

    }
);


// ------------------------------------------
// Clear error while typing
// ------------------------------------------

emailInput.addEventListener(
    "input",
    () => {

        emailError.textContent = "";

        emailInput.classList.remove(
            "input-error"
        );

        recoveryStatus.textContent = "";

        recoveryStatus.className = "status";

    }
);