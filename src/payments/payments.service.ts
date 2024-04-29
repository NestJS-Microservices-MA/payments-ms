import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Request, Response } from 'express';
import Stripe from 'stripe';

import { NATS_SERVICE, envs } from 'src/config';
import { PaymentSessionDto } from './dto/payment-session.dto';

@Injectable()
export class PaymentsService {
    private readonly stripe = new Stripe(envs.stripeSecret)
    private readonly logger = new Logger('PaymentsMS - Service')

    constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

    async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
        const { currency, items, orderId } = paymentSessionDto;
        const lineItems = items.map(item => ({
            price_data: {
                currency,
                product_data: {
                    name: item.name,
                },
                unit_amount: Math.round(item.price * 100), // Change to cents
            },
            quantity: item.quantity,
        }));


        const session = await this.stripe.checkout.sessions.create({
            // Colocar aqui el id de mi orden
            payment_intent_data: {
                metadata: {
                    orderId,
                }
            },
            line_items: lineItems,
            mode: 'payment',
            success_url: envs.stripeSuccessUrl,
            cancel_url: envs.stripeCancelUrl,
        });

        return {
            cancelUrl: session.cancel_url,
            successUrl: session.success_url,
            sessionUrl: session.url,
        };
    }

    async stripeWebhook( req: Request, res: Response) {
        const sig = req.headers['stripe-signature'];
        
        let event: Stripe.Event;
        const endpointSecret = envs.stripeEndpointSecret;

        try {
            event = this.stripe.webhooks.constructEvent(req['rawBody'], sig, endpointSecret);
        } catch (err) {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        switch (event.type) {
            case 'charge.succeeded':
                const charge = event.data.object;
                const payload = {
                    stripePaymentId: charge.id,
                    orderId: charge.metadata.orderId,
                    receiptUrl: charge.receipt_url,
                }
                
                this.client.emit('payment.succeeded', payload);
                break;
            default:
                console.log(`Uncontrolled event`);
                break;
        }

        return res.status(200).json({ sig });
    }
}
