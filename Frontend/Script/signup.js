const form = document.getElementById("signupForm");
const successState = document.getElementById("successState");
const backToForm = document.getElementById("backToForm");
const password = document.getElementById("password");
const strength = document.querySelector(".strength");

/* ---------- interest picker ---------- */

const picker = document.getElementById("interestPicker");
const trigger = document.getElementById("interestTrigger");
const panel = document.getElementById("interestPanel");
const interestInput = document.getElementById("interest");
const triggerIcon = document.getElementById("triggerIcon");
const triggerText = document.getElementById("triggerText");
const interestCards = panel.querySelectorAll(".interest-card");

function openPanel() {
  panel.hidden = false;
  picker.classList.add("open");
  trigger.setAttribute("aria-expanded", "true");
}

function closePanel() {
  panel.hidden = true;
  picker.classList.remove("open");
  trigger.setAttribute("aria-expanded", "false");
}

function selectInterest(card) {
  interestInput.value = card.dataset.value;
  triggerText.textContent = card.dataset.label;
  triggerIcon.innerHTML = card.querySelector("svg").outerHTML;
  picker.classList.add("has-value");

  interestCards.forEach((c) => {
    c.setAttribute("aria-selected", c === card ? "true" : "false");
  });

  setError("interest", "interestError", "");
  closePanel();
  trigger.focus();
}

function resetInterest() {
  interestInput.value = "";
  triggerText.textContent = "Select your interest";
  triggerIcon.innerHTML = "";
  picker.classList.remove("has-value", "invalid");
  interestCards.forEach((c) => c.setAttribute("aria-selected", "false"));
  closePanel();
}

trigger.addEventListener("click", () => {
  if (panel.hidden) {
    openPanel();
  } else {
    closePanel();
  }
});

interestCards.forEach((card) => {
  card.addEventListener("click", () => selectInterest(card));
});

document.addEventListener("click", (event) => {
  if (!panel.hidden && !picker.contains(event.target)) {
    closePanel();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) {
    closePanel();
    trigger.focus();
  }
});

/* ---------- helpers ---------- */

function setError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);

  // the hidden interest input shows its error state on the picker wrapper
  const target = input.type === "hidden" ? input.parentElement : input;

  if (message) {
    target.classList.add("invalid");
    error.textContent = message;
  } else {
    target.classList.remove("invalid");
    error.textContent = "";
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function updatePasswordStrength(value) {
  if (!value) {
    strength.removeAttribute("data-level");
    return;
  }

  let level = 0;

  if (value.length >= 8) level++;
  if (/[a-zA-Z]/.test(value) && /\d/.test(value)) level++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) level++;
  if (/[^a-zA-Z0-9]/.test(value)) level++;

  strength.dataset.level = String(Math.max(1, level));
}

password.addEventListener("input", () => {
  updatePasswordStrength(password.value);
});

document.querySelectorAll(".password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.target);
    const showing = target.type === "text";

    target.type = showing ? "password" : "text";
    button.textContent = showing ? "Show" : "Hide";

    button.setAttribute(
      "aria-label",
      showing ? "Show password" : "Hide password"
    );
  });
});

/* ---------- submit ---------- */

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const firstName =
    document.getElementById("firstName").value.trim();

  const lastName =
    document.getElementById("lastName").value.trim();

  const username =
    document.getElementById("username").value.trim();

  const email =
    document.getElementById("email").value.trim();

  const institution =
    document.getElementById("institution").value.trim();

  const passwordValue =
    password.value;

  const confirmPassword =
    document.getElementById("confirmPassword").value;

  const interest =
    document.getElementById("interest").value;

  const terms =
    document.getElementById("terms").checked;

  const submitBtn =
    form.querySelector(".submit-btn");

  let valid = true;

  if (!firstName) {
    setError(
      "firstName",
      "firstNameError",
      "First name is required."
    );
    valid = false;
  } else {
    setError("firstName", "firstNameError", "");
  }

  if (!lastName) {
    setError(
      "lastName",
      "lastNameError",
      "Last name is required."
    );
    valid = false;
  } else {
    setError("lastName", "lastNameError", "");
  }

  if (!username) {
    setError(
      "username",
      "usernameError",
      "Username is required."
    );
    valid = false;
  } else if (!isValidUsername(username)) {
    setError(
      "username",
      "usernameError",
      "Username must be 3-20 characters using letters, numbers or underscore."
    );
    valid = false;
  } else {
    setError("username", "usernameError", "");
  }

  if (!email) {
    setError(
      "email",
      "emailError",
      "Email address is required."
    );
    valid = false;
  } else if (!isValidEmail(email)) {
    setError(
      "email",
      "emailError",
      "Enter a valid email address."
    );
    valid = false;
  } else {
    setError("email", "emailError", "");
  }

  if (!institution) {
    setError(
      "institution",
      "institutionError",
      "Institution name is required."
    );
    valid = false;
  } else if (institution.length < 2) {
    setError(
      "institution",
      "institutionError",
      "Enter the full name of your institution."
    );
    valid = false;
  } else {
    setError("institution", "institutionError", "");
  }

  if (!passwordValue) {
    setError(
      "password",
      "passwordError",
      "Password is required."
    );
    valid = false;
  } else if (passwordValue.length < 8) {
    setError(
      "password",
      "passwordError",
      "Password must be at least 8 characters."
    );
    valid = false;
  } else {
    setError("password", "passwordError", "");
  }

  if (!confirmPassword) {
    setError(
      "confirmPassword",
      "confirmPasswordError",
      "Please confirm your password."
    );
    valid = false;
  } else if (passwordValue !== confirmPassword) {
    setError(
      "confirmPassword",
      "confirmPasswordError",
      "Passwords do not match."
    );
    valid = false;
  } else {
    setError(
      "confirmPassword",
      "confirmPasswordError",
      ""
    );
  }

  if (!interest) {
    setError(
      "interest",
      "interestError",
      "Please select your interest."
    );
    valid = false;
  } else {
    setError(
      "interest",
      "interestError",
      ""
    );
  }

  const termsError =
    document.getElementById("termsError");

  if (!terms) {
    termsError.textContent =
      "Please accept the terms to continue.";
    valid = false;
  } else {
    termsError.textContent = "";
  }

  if (!valid) return;

  const originalBtnContent =
    submitBtn.innerHTML;

  submitBtn.disabled = true;

  submitBtn.innerHTML =
    "<span>Connecting to Secure Node...</span>";

  try {
    const response = await fetch(
      "/api/signup",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          firstName: firstName,
          lastName: lastName,
          username: username,
          email: email,
          institution: institution,
          password: passwordValue,
          interest: interest
        })
      }
    );

    const data = await response.json();

    if (data.status === "otp_required") {

      localStorage.setItem(
        "userEmail",
        email
      );

      await fetch(
        "/send-otp",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            email: email,
            usecase: "SIGNUP"
          })
        }
      );

      alert(
        "OTP sent to entered email successfully."
      );

      window.location.href = "/otp";

    } else if (response.ok) {

      form.style.display = "none";

      successState.classList.add(
        "visible"
      );

    } else {

      alert(
        data.message ||
        "Registration failed."
      );
    }

  } catch (error) {

    console.error(error);

    alert(
      "Server connection failed."
    );

  } finally {

    submitBtn.disabled = false;

    submitBtn.innerHTML =
      originalBtnContent;
  }
});

backToForm.addEventListener(
  "click",
  () => {

    form.reset();

    strength.removeAttribute(
      "data-level"
    );

    document
      .querySelectorAll(".error")
      .forEach((error) => {
        error.textContent = "";
      });

    document
      .querySelectorAll("input, select")
      .forEach((input) => {
        input.classList.remove("invalid");
      });

    resetInterest();

    successState.classList.remove(
      "visible"
    );

    form.style.display = "";
  }
);

