import {startServer} from '../../dist/server/main.js';
const runtime=await startServer({workspace:process.argv[2],port:0});
process.send({origin:runtime.origin});
process.on('message',async()=>{await runtime.close();process.exit(0);});
