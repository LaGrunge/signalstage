import { Router } from "express";

// Express 4 does not catch a rejected promise coming out of an async route
// handler: it escapes as an unhandled rejection and takes the process down.
// That process is also the Hocuspocus collab server, so one unexpected query
// error drops *every* live interview, not just the request that hit it - a
// folder rename that violated a NOT NULL constraint did exactly that, and the
// symptom the user saw was "renaming a folder does nothing" rather than
// anything resembling a server error.
//
// Routers built here forward those rejections into Express's normal error
// handling instead, where index.js's error middleware turns them into a 500.
// Use this in place of Router() for anything with async handlers, which here
// means all of them.
const METHODS = ["get", "post", "put", "patch", "delete", "all", "use"];

export function asyncRouter() {
  const router = Router();
  for (const method of METHODS) {
    const original = router[method].bind(router);
    router[method] = (...args) => original(...args.map(wrap));
  }
  return router;
}

function wrap(handler) {
  if (typeof handler !== "function") return handler;
  // A mounted sub-router is a function too, and already routes its own
  // errors - leave it alone. So is error-handling middleware, which Express
  // recognises purely by its four-argument arity.
  if (handler.stack || handler.length === 4) return handler;
  return (req, res, next) => {
    try {
      return Promise.resolve(handler(req, res, next)).catch(next);
    } catch (err) {
      next(err);
      return undefined;
    }
  };
}
