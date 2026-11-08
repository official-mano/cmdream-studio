import "./styles.css";
import { createSupabaseClient, getAuthRedirectUrl, watchAuthState } from "./accounts.js";

const form = document.querySelector("#account-form");
const notice = document.querySelector("#account-notice");
const signedInPanel = document.querySelector("#signed-in-panel");
const emailInput = document.querySelector("#account-email");
const passwordInput = document.querySelector("#account-password");
const recoveryForm = document.querySelector("#password-recovery-form");
const recoveryPassword = document.querySelector("#recovery-password");
const recoveryPasswordConfirm = document.querySelector("#recovery-password-confirm");
let client = null;
let session = null;
let recoveryMode = false;

function showNotice(message, kind = "info") {
  notice.textContent = message;
  notice.dataset.kind = kind;
}

function updateSession(nextSession) {
  session = nextSession;
  signedInPanel.classList.toggle("hidden", !session || recoveryMode);
  form.classList.toggle("hidden", Boolean(session) || recoveryMode);
  recoveryForm.classList.toggle("hidden", !recoveryMode);
  if (session?.user?.email) {
    document.querySelector("#signed-in-email").textContent = session.user.email;
  }
}

try {
  client = createSupabaseClient();
  if (!client) {
    showNotice("Accounts are not configured on this website yet. Set the Supabase URL and publishable key in the site host settings.", "error");
    form.querySelectorAll("input,button").forEach((element) => { element.disabled = true; });
  } else {
    watchAuthState(client, (nextSession, error, event) => {
      if (error) {
        showNotice(`Could not check your account session: ${error.message}`, "error");
        return;
      }
      if (event === "PASSWORD_RECOVERY") {
        recoveryMode = true;
        recoveryForm.classList.remove("hidden");
        form.classList.add("hidden");
        signedInPanel.classList.add("hidden");
        showNotice("Choose a new password for your account.", "info");
        return;
      }
      if (event === "USER_UPDATED" && recoveryMode) {
        recoveryMode = false;
        recoveryForm.reset();
        showNotice("Your password has been updated.", "success");
      }
      updateSession(nextSession);
      if (nextSession && !recoveryMode && event !== "USER_UPDATED") {
        showNotice("You are signed in. Your scenes can sync from the workspace.", "success");
      }
    });
  }
} catch (error) {
  showNotice(error.message, "error");
  form.querySelectorAll("input,button").forEach((element) => { element.disabled = true; });
}

async function runAuthAction(action) {
  if (!client) return;
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email) {
    showNotice("Enter the email address for your account.", "error");
    emailInput.focus();
    return;
  }
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    if (action === "signin") {
      if (!password) throw new Error("Enter your password.");
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showNotice("Signed in. Your scene history will sync when you open the workspace.", "success");
    } else if (action === "signup") {
      if (password.length < 10) throw new Error("Use a password with at least 10 characters.");
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: getAuthRedirectUrl() }
      });
      if (error) throw error;
      if (data.session) {
        showNotice("Account created and signed in.", "success");
      } else {
        showNotice("Account created. Check your email to confirm the address, then sign in.", "success");
      }
    } else {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: getAuthRedirectUrl() });
      if (error) throw error;
      showNotice("If an account exists for that address, a password-reset email has been sent.", "success");
    }
  } catch (error) {
    showNotice(error.message || "Account request failed. Please try again.", "error");
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runAuthAction("signin");
});
document.querySelector("#account-signup").addEventListener("click", () => runAuthAction("signup"));
document.querySelector("#account-reset").addEventListener("click", () => runAuthAction("reset"));
recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client || !recoveryMode) return;
  if (recoveryPassword.value.length < 10) {
    showNotice("Use a password with at least 10 characters.", "error");
    recoveryPassword.focus();
    return;
  }
  if (recoveryPassword.value !== recoveryPasswordConfirm.value) {
    showNotice("The passwords do not match.", "error");
    recoveryPasswordConfirm.focus();
    return;
  }
  const submitButton = recoveryForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  try {
    const { error } = await client.auth.updateUser({ password: recoveryPassword.value });
    if (error) throw error;
    recoveryMode = false;
    recoveryForm.reset();
    updateSession(session);
    showNotice("Your password has been updated.", "success");
  } catch (error) {
    showNotice(`Could not update your password: ${error.message}`, "error");
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelector("#account-signout").addEventListener("click", async () => {
  if (!client || !session) return;
  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;
    updateSession(null);
    showNotice("Signed out. This device’s local scene history remains available.", "success");
  } catch (error) {
    showNotice(`Could not sign out: ${error.message}`, "error");
  }
});
