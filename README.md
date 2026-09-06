# Thesis

A one-page, responsive project showcase built with React, TypeScript, and Three.js.

## Run

The application lives directly in the `thesislanding` repository root. Run these commands from that root:

- `npm install`
- `npm run dev`
- `npm run build`
- `npx tsc --noEmit`

## Editions

- `/` preserves the original five-world showcase, including the Brooklyn theme, heading, and theme selector.
- `/construction` is the separate **Construction** edition: only the animated Brooklyn cityscape and project buildings. It retains the responsive scrolling wheel, 20% hover zoom, video previews, and keyboard controls. Its layout styles and selection state are separate from the original page, and it respects system reduced-motion preferences. It does not load the extra page-typography renderer.

## Five worlds

- **Roots**: a floating moss island, modeled trunk and branches, tapered hanging roots, instanced canopy, saplings, drifting leaves, and fireflies.
- **Brooklyn**: a full-viewport dusk cityscape with five layers of buildings, lit windows, fire escapes, rooftop water towers, cranes, and animated traffic. Each project is a building under construction with open steelwork, concrete floors, masonry sides, scaffolding, a working crane, a traveling construction lift, and fluttering safety mesh. Its front carries the video and newspaper project placard.
- **Steampunk**: an expansive workshop with an armillary, wall-sized moving gears, pressure boilers, pipes, benches, instrument shelves, gauges, hanging lamps, and drifting steam; tiles become brass-framed panels.
- **Volcanic**: an erupting basalt volcano with flowing lava and airborne embers; project housings have glowing magma seams and rock edges.
- **Space**: a full-screen volumetric nebula with 4,200 colored cloud particles, 2,400 stars with diffraction glints, and 28 moving meteors; project housings become illuminated spacecraft panels.

The project wheel uses as many columns as the viewport allows. Native page scrolling drives consistent cylindrical curvature and depth across rows. All tiles share one resting orientation. Hovering zooms a project toward the viewer to approximately 120% of its resting projected size and holds its tilt steady; leaves, gears, gauges, lava, and other internal animations continue. Keyboard focus also enlarges the object.

Drag a scene to orbit. Focus the scene and use arrow keys to rotate by keyboard. The ambient motion button pauses animation. The selected world and motion preference are remembered on this device. System reduced-motion preferences are respected. Mobile vertical page scrolling is preserved.

Click a project image or title to load and play its muted video preview. Click again to stop. Only one video mounts at a time; videos pause offscreen and in background tabs. Failed previews provide retry feedback.

## Replace concept content

`lib/projects.ts` contains six deliberately fictional example projects and illustrative financial figures. Replace these with verified project records. Set each record's `x` and `telegram` to its official HTTPS URLs; until then the icons explain that no community link has been configured. No live pricing service or wallet integration is connected.

## Physical 3D project tiles

Each project is also a real Three.js object: a thick beveled housing, modeled sidewalls, an inset screen, extruded text geometry for all visible names, captions, categories, market caps, changes, and playback labels. The page headings, interface labels, and theme controls are also rendered with Three.js text and panel geometry. Roots adds vines, hanging roots, foliage, and falling leaves. Brooklyn adds deep masonry, exposed concrete floors, steel columns and rebar, scaffolding, safety stripes, a construction elevator, fluttering mesh, and an operating roof crane. Steampunk adds pipes, rivets, rotating gears, and a moving gauge.

All six objects share one WebGL renderer using scissored viewports; only visible objects render. A separate renderer handles the hero world, and one shared lightweight renderer handles page typography and theme control geometry. These are three total WebGL contexts, never one context per card. Selecting a project feeds its HTML video into a VideoTexture on the object. The semantic HTML beneath the scene supplies keyboard interaction, accessible content, and a readable fallback if WebGL is unavailable.

## Performance

Three.js is dynamically imported after the readable interface renders. The scenes use instanced foliage, bricks, and windows, merged root geometry, modest meshes, no postprocessing, a device pixel ratio capped at 1.5 (1.25 on narrow screens), and no mobile shadows. The animation loop sleeps when the scene is offscreen or the document is hidden. GPU geometries, materials, textures, and the renderer are disposed when switching worlds. Videos are local, muted, and fetched only on selection. Local WebP posters avoid remote image requests; lower-row images are lazy loaded. Fonts are hosted locally. Readable semantic HTML remains available if WebGL or the 3D font fails; the original three worlds also have artwork fallbacks.

## Assets

Three original theme artworks in `public/art` were generated with built-in imagegen for this project. They are used for the loading/fallback presentation, and the retained original Brooklyn diorama texture. They are not substitutes for the modeled 3D scenes.

Prompts: a floating mossy forest island with hanging roots; a red-brick Brooklyn warehouse with graffiti and a rooftop water tower; and an intricate brass celestial observatory. No logos or UI were requested.

Project poster/video footage is from [Mixkit](https://mixkit.co/), under its [stock-video license](https://mixkit.co/license/#videoFree). The supplied 360p clips are appropriate to card-sized previews. Asset IDs: 41401, 4266, 41537, 2168, 40657, 41389. Source collections: [aerial](https://mixkit.co/free-stock-video/aerial/) and [forest](https://mixkit.co/free-stock-video/forest/). These clips are illustrative, not representations of actual token issuers.

## Validation

TypeScript and the production build are checked during delivery. Run `node --experimental-strip-types --test tests/gallery-interaction.test.mjs` for regression checks covering projected hover size, visible-object picking, scroll/viewport transforms, leaving/switching tiles, overlap priority, and animated Brooklyn geometry. Browser interaction testing and device frame-rate benchmarks have not been performed; the performance controls above are implementation safeguards rather than measured speed claims.

## Hover interaction

Mouse picking uses the same Three.js camera, model matrix, and scissored viewport as rendering. Transparent DOM elements never expand or determine pointer hover. One foreground tile owns overlapping hits; moving off releases it. A single eased progress controls forward movement, perspective-compensated 1.2x zoom and settling tilt. Internal theme animation and selected video continue. Pointer clicks use projected local coordinates for playback and community actions; native keyboard controls remain available.

