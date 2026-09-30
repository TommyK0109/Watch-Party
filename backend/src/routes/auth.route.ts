import { Router } from "express";

import {
  register,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  login,
  logout,
  me,
  refresh
} from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

router.post("/login", login);

router.post("/logout", logout);

router.post("/refresh", refresh);

router.get("/me", requireAuth, me);

export default router;
