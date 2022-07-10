import { Router } from 'worktop';
import { listen } from 'worktop/cache';
import * as CORS from 'worktop/cors';
import * as Routes from './routes';

const API = new Router();

API.prepare = CORS.preflight({
	origin: '*', // allow any `Origin` to connect
	headers: ['Cache-Control', 'Content-Type', 'X-Count'],
	methods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
})

API.add('POST', '/residences/:story/:room', Routes.save);
API.add('GET', '/residences/:story/:room', Routes.find);

API.add('GET', '/residencesupdates/:yyyy/:mm/:dd', Routes.residencesupdates);

API.add('GET', '/metadata/:story/:room', Routes.metadata);

API.add('GET', '/metadata/:story/:room/marketplace', Routes.metadataMarketplace);

API.add('POST', '/owner/:owner', Routes.updateOwner);
API.add('GET', '/owner/:owner', Routes.owned);

API.add('GET', '/residences/:story/:room/image', Routes.image);
API.add('GET', '/residences/:story/:room/billboard', Routes.billboard);
API.add('POST', '/residences/:story/:room/billboard', Routes.billboardSave);
API.add('GET', '/residences/:story/:room/socialcard', Routes.socialcard);

API.add('GET', '/nft/:mintAddr', Routes.getNFTByMintAddress);

API.add('POST', '/jwt/fromsignedmessage', Routes.jwtFromSignedMessage);
API.add('POST', '/jwt/fromtransaction/init', Routes.jwtFromTransactionInit);
API.add('POST', '/jwt/fromtransaction/verify', Routes.jwtFromTransactionVerify);

listen(API.run);