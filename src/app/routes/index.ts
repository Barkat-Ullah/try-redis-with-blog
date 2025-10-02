import express from 'express';

import { NotificationsRouters } from '../modules/Notification/notification.route';

import { AssetRouters } from '../modules/Asset/asset.route';
import { AuthRouters } from '../modules/Auth/Auth.routes';

import { PaymentRoutes } from '../modules/Payment/payment.route';
import { FollowRoutes } from '../modules/follow/follow.routes';
import { BlogRoutes } from '../modules/blog/blog.routes';
import { CommentRoutes } from '../modules/comment/comment.routes';

const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRouters,
  },
  {
    path: '/blog',
    route: BlogRoutes,
  },
  {
    path: '/comments',
    route: CommentRoutes,
  },

  {
    path: '/payment',
    route: PaymentRoutes,
  },
  {
    path: '/follow',
    route: FollowRoutes,
  },
  {
    path: '/notifications',
    route: NotificationsRouters,
  },
  {
    path: '/assets',
    route: AssetRouters,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
