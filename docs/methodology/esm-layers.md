# ESM layers (environmental sensitivity suggestions)

The validator confirms ESM (1.0 to 1.3) for environment actions. To help, the server checks the site
coordinates against open map layers and suggests a value. Only layers whose licence allows commercial use
with attribution are used.

| Layer | Licence | Suggested ESM inside |
|---|---|---|
| Global Mangrove Watch (extent) | CC BY 4.0 | 1.3 |
| Allen Coral Atlas (reef extent) | CC BY 4.0 | 1.3 |
| Hansen / UMD Global Forest Change (tree cover, not lost) | CC BY 4.0 | 1.2 |
| RESOLVE Ecoregions 2017 (for context, no bonus by default) | CC BY 4.0 | 1.0 |
| OpenStreetMap protected areas (own extract, not the public Overpass API) | ODbL | 1.2 |

Not used: WDPA / Protected Planet, IUCN Red List, KBA, IBAT (their terms forbid commercial use). A test in
`packages/impact-engine/test/esm-layers.test.ts` fails if code calls their APIs.

## Setup on the server

1. Download each layer from its official source and clip it to the pilot regions (for example the Gulf of
   Thailand islands), then convert to GeoJSON in WGS84, for example:
   `ogr2ogr -f GeoJSON -t_srs EPSG:4326 -clipsrc 99.8 9.4 100.2 9.9 gmw-kpg.geojson <source>`
2. Put the files in one directory with a `layers.json` manifest:
   ```json
   [
     { "id": "gmw-2020", "name": "Global Mangrove Watch", "licence": "CC BY 4.0",
       "attribution": "Global Mangrove Watch", "esm": 1.3, "file": "gmw-kpg.geojson" }
   ]
   ```
3. Set `ESM_LAYERS_DIR` to that directory for the web container (mount it as a read-only volume) and restart.

Files over 50 MB are skipped; clip them smaller. Attribution for every layer is listed on `/methodology#sources`.
