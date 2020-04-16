import { readable } from 'svelte/store';
import { globalHistory } from "./history.js";

const globalLocation = readable(globalHistory.location, function create(set) {
    const unlisten = globalHistory.listen(history => {
      set(history.location);
    });

    return function destroy() {
        unlisten();
    }
});

export {
    globalLocation,
};
