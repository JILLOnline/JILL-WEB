import {type RouteConfig,index,route} from "@react-router/dev/routes";
export default [
  index("routes/index.tsx"),
  route("auth/login","routes/auth.login.tsx"),
  route("auth/*","routes/auth.catchall.tsx"),
  route("app","routes/app.tsx",[
    index("routes/app.index.tsx"),
    route("requests","routes/app.requests.layout.tsx",[
      index("routes/app.requests.tsx"),
      route(":submissionId","routes/app.requests.$submissionId.tsx"),
    ]),
    route("requests/command","routes/app.requests.command.tsx"),
    route("requests/media/inspect","routes/app.requests.media.inspect.tsx"),
    route("setup-owner","routes/app.setup-owner.tsx"),
  ]),
] satisfies RouteConfig;
