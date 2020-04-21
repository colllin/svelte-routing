<script>
  import { getContext, setContext, onMount, onDestroy } from "svelte";
  import { writable, derived } from "svelte/store";
  import { LOCATION, ROUTER } from "./contexts.js";
  import { pick, match, stripSlashes, combinePaths } from "./utils.js";
  import { globalLocation } from './stores.js';

  export let basepath = "/";
  export let location = null;
  // export let activeRoute = null;
  const routes = writable([]);
  export const hasRoute = (pathname) => !!pick($routes, pathname);

  const maybeConvertPathToLocation = (location) => location && (location.pathname ? location : {pathname: location});
  const locationPropWritable = writable(maybeConvertPathToLocation(location));
  $: locationPropWritable.set(maybeConvertPathToLocation(location));
  const contextLocation = getContext(LOCATION) || writable(null);
  const routerLocationReadable = derived([locationPropWritable, contextLocation, globalLocation], ([$locationProp, $contextLocation, $globalLocation]) => {
      // If the `path` prop is given we force the location to it.
      // If locationContext is not set, then we derive from window location.
      let routerLocation = $locationProp || $contextLocation || $globalLocation;
      // console.log('routerLocationReadable.set()', routerLocation);
      return routerLocation;
  });
  setContext(LOCATION, routerLocationReadable);

  const activeRouteReadable = derived([routerLocationReadable, routes], ([$routerLocation, $routes]) => {
    // This reactive statement will be run when the Router is created
    // when there are no Routes and then again the following tick, so it
    // will not find an active Route in SSR and in the browser it will only
    // pick an active Route after all Routes have been registered.
    return pick($routes, $routerLocation.pathname);
  });
  // $: activeRoute = $activeRouteReadable;

  const routerContext = getContext(ROUTER);
  // If routerContext is set, the routerBase of the parent Router
  // will be the base for this Router's descendants.
  // If routerContext is not set, the path and resolved uri will both
  // have the value of the basepath prop.
  const base = routerContext
    ? routerContext.routerBase
    : writable({
        path: basepath,
        uri: basepath
      });

  const routerBase = derived([base, activeRouteReadable], ([$base, $activeRoute]) => {
    // If there is no $activeRoute, the routerBase will be identical to the $base.
    if ($activeRoute === null) {
      return $base;
    }

    const { path: basepath } = $base;
    const { route, uri } = $activeRoute;
    // Remove the potential /* or /*splatname from
    // the end of the child Routes relative paths.
    const path = route.default ? basepath : route.path.replace(/\*.*$/, "");

    return { path, uri };
  });

  function registerRoute(route) {
    const { path: basepath } = $base;
    let { path } = route;

    // We store the original path in the _path property so we can reuse
    // it when the basepath changes. The only thing that matters is that
    // the route reference is intact, so mutation is fine.
    route._path = path;
    route.path = combinePaths(basepath, path);

    if (typeof window === "undefined") {
      // In SSR we should set the activeRoute immediately if it is a match.
      // If there are more Routes being registered after a match is found,
      // we just skip them.
      if ($activeRouteReadable) {
        return;
      }

      const matchingRoute = match(route, $routerLocationReadable.pathname);
      if (matchingRoute) {
        activeRouteReadable = writable(matchingRoute);
      }
    } else {
      routes.update(rs => {
        rs.push(route);
        return rs;
      });
    }
  }

  function unregisterRoute(route) {
    routes.update(rs => {
      const index = rs.indexOf(route);
      rs.splice(index, 1);
      return rs;
    });
  }

  // This reactive statement will update all the Routes' path when
  // the basepath changes.
  $: {
    const { path: basepath } = $base;
    routes.update(rs => {
      rs.forEach(r => (r.path = combinePaths(basepath, r._path)));
      return rs;
    });
  }

  setContext(ROUTER, {
    activeRoute: activeRouteReadable,
    base,
    routerBase,
    registerRoute,
    unregisterRoute
  });
</script>

<slot location={$routerLocationReadable}></slot>
