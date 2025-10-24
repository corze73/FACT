import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { CreditCard, Shield, Clock } from 'lucide-react';
import { calculatePaymentBreakdown, formatCurrency, poundsToPence } from '../../utils/payment';

// Initialize Stripe with guard for missing key
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const PaymentForm = ({ booking, paymentBreakdown, onPaymentSuccess, onPaymentError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError(null);

    const cardElement = elements.getElement(CardElement);

    try {
      // Create payment intent on your backend
  const response = await fetch('/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking_id: booking.id,
          amount: poundsToPence(paymentBreakdown.totalAmount), // Total including £3 admin fee
          currency: 'gbp',
          admin_fee: poundsToPence(paymentBreakdown.adminFee) // £3 admin fee in pence
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Create payment intent failed (${response.status})`);
      }

      const { client_secret, payment_intent_id } = await response.json();

      // Confirm payment with Stripe
      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: booking.client_name,
            email: booking.client_email,
          },
        }
      });

      if (result.error) {
        setPaymentError(result.error.message);
        onPaymentError(result.error);
      } else {
        // Payment succeeded
        await updateBookingPaymentStatus(booking.id, payment_intent_id);
        onPaymentSuccess(result.paymentIntent);
      }
    } catch (error) {
      setPaymentError(error.message);
      onPaymentError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateBookingPaymentStatus = async (bookingId, paymentIntentId) => {
    // Notify backend to confirm payment and update booking status
    await fetch('/stripe/confirm-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        booking_id: bookingId,
        payment_intent_id: paymentIntentId
      }),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border rounded-lg p-4">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
            },
          }}
        />
      </div>

      {paymentError && (
        <Alert variant="destructive">
          <AlertDescription>{paymentError}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-600" />
          <span>Secured by Stripe</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Funds held until session completion</span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
      >
        <CreditCard className="w-4 h-4 mr-2" />
        {isProcessing ? 'Processing...' : `Pay ${formatCurrency(paymentBreakdown.totalAmount)}`}
      </Button>
    </form>
  );
};

export default function StripePaymentModal({ booking, isOpen, onClose, onPaymentSuccess }) {
  const [paymentStep, setPaymentStep] = useState('payment'); // payment, success, error

  // Calculate payment breakdown with fixed £3 admin fee
  const paymentBreakdown = calculatePaymentBreakdown(booking.service_price || booking.price || booking.total_price);

  const handlePaymentSuccess = (paymentIntent) => {
    setPaymentStep('success');
    setTimeout(() => {
      onPaymentSuccess(paymentIntent);
      onClose();
    }, 2000);
  };

  const handlePaymentError = (error) => {
    setPaymentStep('error');
    console.error('Payment failed:', error);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Secure Payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paymentStep === 'payment' && (
            !stripePromise ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertDescription>
                    Stripe publishable key is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in your environment and redeploy.
                  </AlertDescription>
                </Alert>
                <Button variant="outline" onClick={onClose} className="w-full">Close</Button>
              </div>
            ) : (
            <Elements stripe={stripePromise}>
              <div className="space-y-4">
                {/* Booking Summary */}
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Booking Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Service:</span>
                      <span>{booking.service_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span>{booking.duration} hour(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Coach:</span>
                      <span>{booking.coach_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service Price:</span>
                      <span>{formatCurrency(paymentBreakdown.servicePrice)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Admin Fee:</span>
                      <span>{formatCurrency(paymentBreakdown.adminFee)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(paymentBreakdown.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Security Notice */}
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Payment Protection</p>
                      <p className="text-blue-700">
                        Your payment is held securely until session completion. 
                        Full refund if coach doesn&apos;t show up.
                      </p>
                    </div>
                  </div>
                </div>

                <PaymentForm
                  booking={booking}
                  paymentBreakdown={paymentBreakdown}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentError={handlePaymentError}
                />

                <Button variant="outline" onClick={onClose} className="w-full">
                  Cancel
                </Button>
              </div>
            </Elements>
            )
          )}

          {paymentStep === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium mb-2">Payment Successful!</h3>
              <p className="text-slate-600">
                Your booking is confirmed. You&apos;ll receive an email confirmation shortly.
              </p>
            </div>
          )}

          {paymentStep === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-medium mb-2">Payment Failed</h3>
              <p className="text-slate-600 mb-4">
                There was an issue processing your payment. Please try again.
              </p>
              <div className="space-y-2">
                <Button onClick={() => setPaymentStep('payment')} className="w-full">
                  Try Again
                </Button>
                <Button variant="outline" onClick={onClose} className="w-full">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}