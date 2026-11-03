// ==========================================
// PEERSPRINT - OTP VERIFICATION
// ==========================================


// ------------------------------------------
// DOM ELEMENTS
// ------------------------------------------

const inputs = document.querySelectorAll(".otp-input");
const form = document.getElementById("otpForm");

const otpError = document.getElementById("otpError");
const emailDisplay = document.getElementById("emailDisplay");

const verifyBtn = form?.querySelector(".verify");

const resendBtn = document.getElementById("resendBtn");
const timerEl = document.getElementById("timer");

const changeEmailBtn = document.getElementById("changeEmail");

const successState = document.getElementById("successState");
const continueBtn = document.getElementById("continueBtn");


// ------------------------------------------
// CONFIGURATION
// ------------------------------------------

const MAX_VERIFY_ATTEMPTS = 3;

const MAX_SEND_ATTEMPTS = 3;

const VERIFY_COOLDOWN_SECONDS = 60;

const RESEND_COOLDOWN_SECONDS = 30;

const SEND_COUNT_KEY = "peersprint_otp_send_count";
const LAST_SEND_TIME_KEY = "peersprint_otp_last_send_time";


// ------------------------------------------
// STATE
// ------------------------------------------

let verifyAttempts = 0;
let verifyLocked = false;
let countdownTimer = null;


// ------------------------------------------
// SESSION DATA
// ------------------------------------------

const email = localStorage.getItem("userEmail");
const usecase = sessionStorage.getItem("usecase");


// ------------------------------------------
// DISPLAY EMAIL
// ------------------------------------------

if (emailDisplay && email) {
    emailDisplay.textContent = email;
}


// ------------------------------------------
// BASIC SESSION CHECK
// ------------------------------------------

if (!email) {

    showError(
        "Your verification session has expired. Please start again."
    );

    if (verifyBtn) {
        verifyBtn.disabled = true;
    }

}


// ==========================================
// OTP INPUT HANDLING
// ==========================================

inputs.forEach((input, index) => {

    input.addEventListener("input", () => {

        // Keep numbers only
        input.value = input.value.replace(/\D/g, "");

        clearError();

        if (
            input.value &&
            index < inputs.length - 1
        ) {
            inputs[index + 1].focus();
        }

    });


    input.addEventListener("keydown", (event) => {

        // Backspace
        if (
            event.key === "Backspace" &&
            !input.value &&
            index > 0
        ) {
            inputs[index - 1].focus();
        }


        // Left arrow
        if (
            event.key === "ArrowLeft" &&
            index > 0
        ) {
            event.preventDefault();
            inputs[index - 1].focus();
        }


        // Right arrow
        if (
            event.key === "ArrowRight" &&
            index < inputs.length - 1
        ) {
            event.preventDefault();
            inputs[index + 1].focus();
        }

    });


    // --------------------------------------
    // Paste OTP
    // --------------------------------------

    input.addEventListener("paste", (event) => {

        event.preventDefault();

        const pasted = (
            event.clipboardData ||
            window.clipboardData
        )
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 6);


        pasted.split("").forEach((digit, i) => {

            if (inputs[i]) {
                inputs[i].value = digit;
            }

        });


        if (pasted.length < inputs.length) {

            inputs[pasted.length]?.focus();

        } else {

            inputs[inputs.length - 1]?.focus();

        }

        clearError();

    });

});


// ==========================================
// OTP HELPERS
// ==========================================

function getOtpCode() {

    return [...inputs]
        .map(input => input.value)
        .join("");

}


function clearInputs() {

    inputs.forEach(input => {

        input.value = "";
        input.classList.remove("error");

    });

    inputs[0]?.focus();

}


function markInputsError() {

    inputs.forEach(input => {
        input.classList.add("error");
    });

}


function clearInputErrors() {

    inputs.forEach(input => {
        input.classList.remove("error");
    });

}


function showError(message) {

    if (!otpError) return;

    otpError.textContent = message;
    otpError.classList.add("visible");

}


function clearError() {

    if (!otpError) return;

    otpError.textContent = "";
    otpError.classList.remove("visible");

    clearInputErrors();

}


// ==========================================
// SEND LIMIT HELPERS
// ==========================================

function getSendCount() {

    return parseInt(
        sessionStorage.getItem(SEND_COUNT_KEY) || "0",
        10
    );

}


function incrementSendCount() {

    const count = getSendCount() + 1;

    sessionStorage.setItem(
        SEND_COUNT_KEY,
        String(count)
    );

    return count;

}


function hasReachedSendLimit() {

    return getSendCount() >= MAX_SEND_ATTEMPTS;

}


function getRemainingCooldown() {

    const lastSend = parseInt(
        sessionStorage.getItem(LAST_SEND_TIME_KEY) || "0",
        10
    );

    if (!lastSend) {
        return 0;
    }


    const elapsed = Math.floor(
        (Date.now() - lastSend) / 1000
    );


    return Math.max(
        0,
        RESEND_COOLDOWN_SECONDS - elapsed
    );

}


function markOtpSent() {

    sessionStorage.setItem(
        LAST_SEND_TIME_KEY,
        String(Date.now())
    );

}


// ==========================================
// RESEND TIMER
// ==========================================

function updateTimer(seconds) {

    if (!timerEl) return;

    const minutes = Math.floor(seconds / 60);

    const remainingSeconds = seconds % 60;

    timerEl.textContent =
        `${String(minutes).padStart(2, "0")}:` +
        `${String(remainingSeconds).padStart(2, "0")}`;

}


function startResendCooldown(seconds) {

    clearInterval(countdownTimer);

    let remaining = seconds;

    resendBtn.disabled = true;

    updateTimer(remaining);


    countdownTimer = setInterval(() => {

        remaining--;

        updateTimer(remaining);


        if (remaining <= 0) {

            clearInterval(countdownTimer);

            countdownTimer = null;

            updateTimer(0);


            if (hasReachedSendLimit()) {

                lockResend();

            } else {

                resendBtn.disabled = false;

            }

        }

    }, 1000);

}


function lockResend() {

    resendBtn.disabled = true;

    resendBtn.textContent = "Resend limit reached";

    if (timerEl) {
        timerEl.textContent = "";
    }

}


// ==========================================
// VERIFY OTP
// ==========================================

form?.addEventListener("submit", async (event) => {

    event.preventDefault();

    clearError();


    const code = getOtpCode();


    // --------------------------------------
    // Validate OTP
    // --------------------------------------

    if (code.length !== 6) {

        showError(
            "Please enter all 6 digits."
        );

        markInputsError();

        return;

    }


    if (!email) {

        showError(
            "Your verification session has expired. Please start again."
        );

        return;

    }


    // --------------------------------------
    // Loading state
    // --------------------------------------

    verifyBtn.disabled = true;

    verifyBtn.innerHTML =
        "Verifying…";


    try {

        const response = await fetch(
            "/verify-otp",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    email: email,
                    otp: code
                })
            }
        );


        let result;


        try {

            result = await response.json();

        } catch (jsonError) {

            console.error(
                "Invalid OTP response:",
                jsonError
            );

            throw new Error(
                "Invalid server response."
            );

        }


        console.log(
            "OTP verification response:",
            result
        );


        // ==================================
        // SUCCESS
        // ==================================

        if (result.success) {

            verifyAttempts = 0;

            // --------------------------------
            // FORGET PASSWORD
            // --------------------------------

            if (
                result.usecase === "FORGET_PASSWORD"
            ) {

                if (result.reset_token) {

                    sessionStorage.setItem(
                        "reset_token",
                        result.reset_token
                    );

                }


                showSuccessState(
                    "Email verified.",
                    "Continue to reset your password."
                );


                setTimeout(() => {

                    window.location.href =
                        "/Pass_reset";

                }, 700);


                return;

            }


            // --------------------------------
            // LOGIN / SIGNUP
            // --------------------------------

            if (
                result.usecase === "LOGIN" ||
                result.usecase === "SIGNUP"
            ) {

                showSuccessState(
                    "Email verified.",
                    "Your PeerSprint account is ready."
                );


                // --------------------------------
                // Check JWT
                // --------------------------------

                try {

                    const jwtResponse =
                        await fetch(
                            "/JWT_check",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                credentials: "include",

                                body: JSON.stringify({
                                    email: email
                                })
                            }
                        );


                    const jwtResult =
                        await jwtResponse.json();


                    console.log(
                        "JWT response:",
                        jwtResult
                    );


                    if (jwtResult.success) {
                        setTimeout(() => { 
                            window.location.href = "/Front_page"; 
                        }, 
                        700); 
                    }else {

                        showError(
                            jwtResult.message ||
                            "Verification succeeded, but session could not be created."
                        );

                        verifyBtn.disabled = false;

                    }

                } catch (jwtError) {

                    console.error(
                        "JWT Error:",
                        jwtError
                    );

                    showError(
                        "Verification succeeded, but we could not create your session."
                    );

                    verifyBtn.disabled = false;

                }


                return;

            }


            // --------------------------------
            // Unknown usecase
            // --------------------------------

            showError(
                "Verification succeeded, but the request type is unknown."
            );

            verifyBtn.disabled = false;

            return;

        }


        // ==================================
        // WRONG OTP
        // ==================================

        if (result.code === "WRONG_OTP") {

            verifyAttempts++;

            markInputsError();

            if (
                verifyAttempts >=
                MAX_VERIFY_ATTEMPTS
            ) {

                verifyAttempts = 0;

                showError(
                    "Too many incorrect attempts. Please wait 60 seconds."
                );

                startVerificationCooldown();

            } else {

                const remaining =
                    MAX_VERIFY_ATTEMPTS -
                    verifyAttempts;

                showError(
                    `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
                );

            }

            clearInputs();

            return;

        }


        // ==================================
        // EXPIRED OTP
        // ==================================

        if (result.code === "OTP_EXPIRED") {

            markInputsError();

            showError(
                "This verification code has expired. Please request a new one."
            );


            if (hasReachedSendLimit()) {

                lockResend();

            } else {

                resendBtn.disabled = false;

            }

            clearInputs();

            return;

        }


        // ==================================
        // REDIS ERROR
        // ==================================

        if (result.code === "REDIS_ERROR") {

            showError(
                "Verification service is temporarily unavailable. Please try again."
            );

            return;

        }


        // ==================================
        // GENERIC ERROR
        // ==================================

        showError(
            result.message ||
            "Unable to verify the code. Please try again."
        );


    } catch (error) {

        console.error(
            "OTP verification error:",
            error
        );

        showError(
            "Unable to connect to the server. Please try again."
        );

    } finally {

        if (
            !successState?.classList.contains("active")
        ) {

            verifyBtn.disabled = verifyLocked;

            verifyBtn.innerHTML =
                'Verify email <span>→</span>';

        }

    }

});


// ==========================================
// VERIFICATION COOLDOWN
// ==========================================

function startVerificationCooldown() {

    verifyLocked = true;

    verifyBtn.disabled = true;

    let remaining =
        VERIFY_COOLDOWN_SECONDS;


    const timer = setInterval(() => {

        remaining--;


        if (remaining <= 0) {

            clearInterval(timer);

            verifyLocked = false;

            verifyBtn.disabled = false;

            clearError();

            return;

        }


        showError(
            `Too many incorrect attempts. Try again in ${remaining}s.`
        );

    }, 1000);

}


// ==========================================
// RESEND OTP
// ==========================================

resendBtn?.addEventListener(
    "click",
    async () => {

        clearError();


        if (hasReachedSendLimit()) {

            lockResend();

            return;

        }


        if (!email || !usecase) {

            showError(
                "Your verification session has expired. Please start again."
            );

            return;

        }


        // ----------------------------------
        // Disable immediately
        // ----------------------------------

        resendBtn.disabled = true;

        resendBtn.textContent =
            "Sending…";


        try {

            const response = await fetch(
                "/send-otp",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email: email,
                        usecase: usecase
                    })
                }
            );


            let result;


            try {

                result = await response.json();

            } catch (jsonError) {

                throw new Error(
                    "Invalid resend response."
                );

            }


            console.log(
                "Resend OTP response:",
                result
            );


            if (!response.ok || !result.success) {

                throw new Error(
                    result.message ||
                    "Unable to send a new verification code."
                );

            }


            // --------------------------------
            // Successful resend
            // --------------------------------

            incrementSendCount();

            markOtpSent();

            clearInputs();

            showError(
                "A new verification code has been sent."
            );


            startResendCooldown(
                RESEND_COOLDOWN_SECONDS
            );


        } catch (error) {

            console.error(
                "Resend OTP error:",
                error
            );


            showError(
                error.message ||
                "Unable to send a new verification code."
            );


            // Allow retry if request itself failed
            if (!hasReachedSendLimit()) {

                resendBtn.disabled = false;

                resendBtn.textContent =
                    "Resend code";

            } else {

                lockResend();

            }

        }

    }
);


// ==========================================
// CHANGE EMAIL
// ==========================================

changeEmailBtn?.addEventListener(
    "click",
    () => {

        localStorage.removeItem(
            "userEmail"
        );

        sessionStorage.removeItem(
            "usecase"
        );

        sessionStorage.removeItem(
            SEND_COUNT_KEY
        );

        sessionStorage.removeItem(
            LAST_SEND_TIME_KEY
        );


        window.location.href =
            "/signup";

    }
);


// ==========================================
// SUCCESS STATE
// ==========================================

function showSuccessState(title, message) {

    if (!form || !successState) return;


    form.style.display = "none";

    successState.classList.add("active");


    const heading =
        successState.querySelector("h2");

    const paragraph =
        successState.querySelector("p");


    if (heading) {
        heading.textContent = title;
    }

    if (paragraph) {
        paragraph.textContent = message;
    }

}


// ==========================================
// CONTINUE BUTTON
// ==========================================

continueBtn?.addEventListener(
    "click",
    () => {

        window.location.href =
            "/Front_page";

    }
);


// ==========================================
// PAGE LOAD
// ==========================================

window.addEventListener(
    "load",
    () => {

        if (!inputs.length) return;


        inputs[0].focus();


        // ----------------------------------
        // Resend state
        // ----------------------------------

        if (hasReachedSendLimit()) {

            lockResend();

            return;

        }


        const remaining =
            getRemainingCooldown();


        if (remaining > 0) {

            startResendCooldown(
                remaining
            );

        } else {

            resendBtn.disabled = false;

            resendBtn.textContent =
                "Resend code";

            updateTimer(0);

        }

    }
);