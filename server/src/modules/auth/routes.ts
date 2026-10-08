import { Router } from 'express';

import { actorOf, AuthedRequest } from '../../core/actor';
import { authenticate } from '../../core/middleware/authenticate';
import { loginRateLimit } from '../../core/middleware/loginRateLimit';
import { validateBody } from '../../core/middleware/validate';
import { clearAuthCookie, setAuthCookie } from '../../core/tokens';
import { asyncHandler } from '../../lib/asyncHandler';
import { changePasswordSchema, loginSchema, logoutSchema } from './schemas';
import { changePassword, getMe, login } from './service';

const router = Router();

router.post(
  '/login',
  ...loginRateLimit,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { app } = req.body;
    const { token, user } = await login(req.body, req.ip);

    // Web keeps the token out of page JS entirely (httpOnly cookie). The admin
    // panel is web-only, so it never receives the token in the body; the native
    // mobile app has no cookie jar it can rely on and stores the body token in
    // SecureStore.
    setAuthCookie(res, app, token);
    res.json(app === 'mobile' ? { token, user } : { user });
  }),
);

router.post('/logout', validateBody(logoutSchema), (req, res) => {
  clearAuthCookie(res, req.body.app);
  res.status(204).end();
});

const anyApp = authenticate(['mobile', 'admin'], { allowPasswordChangePending: true });

router.get(
  '/me',
  anyApp,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await getMe(actorOf(req)));
  }),
);

router.post(
  '/change-password',
  anyApp,
  validateBody(changePasswordSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const actor = actorOf(req);
    const token = await changePassword(actor, req.body.currentPassword, req.body.newPassword);
    setAuthCookie(res, actor.app, token);
    res.json(actor.app === 'mobile' ? { ok: true, token } : { ok: true });
  }),
);

export default router;
