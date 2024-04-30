import { Module } from '@nestjs/common';
import { ClientsModule, NatsOptions, Transport } from '@nestjs/microservices';

import { envs } from 'src/config';
import { NATS_SERVICE } from 'src/config/services';

interface NatsConfig extends NatsOptions {
    name: string;
} 

const natsConfig = {
    name: NATS_SERVICE,
    transport: Transport.NATS,
    options: {
      servers: envs.natsServers,
    }
} as NatsConfig;

@Module({
    imports: [
        ClientsModule.register([natsConfig]),
    ],
    exports: [
        ClientsModule.register([natsConfig]),
    ],
})
export class NatsModule {}
