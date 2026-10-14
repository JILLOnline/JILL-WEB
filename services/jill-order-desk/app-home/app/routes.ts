import {type RouteConfig,index,route} from "@react-router/dev/routes";
export default [
  index("routes/index.tsx"),
  route("auth/login","routes/auth.login.tsx"),
  route("auth/*","routes/auth.catchall.tsx"),
  route("app","routes/app.tsx",[
    index("routes/app.index.tsx"),
  ]),
] satisfies RouteConfig;
