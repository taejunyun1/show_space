/** A local rotation can be active without a detached project preview. */
export function hasEditorGesture(state:{previewProject:unknown;wallGesture:unknown;artworkGesture:unknown;lightGesture:unknown;modelArtworkGesture:unknown;outdoorGesture:unknown;rotatingArtworkId:unknown}){
 return !!(state.previewProject||state.wallGesture||state.artworkGesture||state.lightGesture||state.modelArtworkGesture||state.outdoorGesture||state.rotatingArtworkId);
}
