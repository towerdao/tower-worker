# Tower Worker

Open sourced backend for [towerdao.com](towerdao.com). In the future, this project will be better modularized for ease of use and expansion by other projects. In the meantime, we have open sourced this repository as an example backend which other projects can use to build their own Web3 apps, taking advantage of the [Solana Blockchain](https://solana.com/) and the incredible scalability of [Cloudflare Workers](https://workers.cloudflare.com/).

Feel free to open an issue, or pop into our [Discord](https://discord.gg/dVpBsmTEjt) if you have any questions on Web3 Dev!


## Overview

Much of this API codebase is very Tower specific, and if adapted to another web3 project will likely need to be greatly changed to fit that platform. However, some routes in the API are extremely generalizable, and will be useful as-is in any project. Below is an overview of each API route.

- `POST /residences/:story/:room`
    - Saves updated Residence data into the Cloudflare KV database
- `GET /residences/:story/:room`
    - Gets Residence data from the Cloudflare KV database
- `GET /residencesupdates/:yyyy/:mm/:dd`
    - Gest ResidenceUpdate data from the Cloudflare KV database
- `GET /metadata/:story/:room`
    - Gets full Residence metadata from both the Cloudflare KV database and on-chain information
- `GET /metadata/:story/:room/marketplace`
    - Gets marketplace name for a Residence
- `POST /owner/:owner`
    - Saves updated Owner data into Cloudflare KV database and on-chain information
- `GET /owner/:owner`
    - Gets full Owner metadata from both the Cloudflare KV database and on-chain information
- `GET /residences/:story/:room/image`
    - Gets Residence image from Cloudflare Images
- `GET /residences/:story/:room/billboard`
    - Gets Residence billboard from Cloudflare Images
- `POST /residences/:story/:room/billboard`
    - Saves updated Residence billboard into Cloudflare Images
- `GET /residences/:story/:room/socialcard`
    - Gets Residence socialcard from Cloudflare Images
- `GET /nft/:mintAddr`
    - Gets image and metadata for ***any*** Solana NFT. Useful for any Web3 app

## Usage

Please get basically familiar with Cloudflare Wrangler (https://developers.cloudflare.com/workers/wrangler/get-started/) before attempting to use this repo. As with following that getting started guide, make sure to correctly setup your local `wrangler.toml` of your copy of this repo. If using this project to build your own projects, you will likely be modifiying it greatly, but read the *Overview* section above to see what existing routes may be useful to your usecase.