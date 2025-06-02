document.addEventListener('DOMContentLoaded', async function () {
    const payButton = document.getElementById('rzp-button');
    const spinner = payButton.querySelector('.spinner-border');

    // Disable button initially during setup
    payButton.disabled = true;

    try {
        // Parse data from hidden inputs
        const bookingData = JSON.parse(document.getElementById('booking-data').value);
        const userData = JSON.parse(document.getElementById('user-data').value);
        const serviceData = JSON.parse(document.getElementById('service-data').value);

        // Determine payment type (advance or final)
        const paymentType = document.getElementById('payment-type')?.value || 'advance';

        // Calculate payment amounts based on type
        let paymentAmount;
        let description;
        let paymentFlow;

        if (paymentType === 'advance') {
            // 15% deposit for advance payment - goes directly to platform
            paymentAmount = Math.round(serviceData.customCost * 0.15);
            description = 'Booking Deposit (15%)';
            paymentFlow = {
                recipient: 'platform',
                autoTransfer: false,
                depositHold: true
            };
        } else {
            // For final payment - 85% remaining amount
            const depositAmount = Math.round(serviceData.customCost * 0.15);
            paymentAmount = serviceData.customCost - depositAmount;
            description = 'Final Payment (85%)';

            // Calculate commission and provider amount
            const platformCommission = Math.round(paymentAmount * 0.10);
            const providerAmount = paymentAmount - platformCommission;

            paymentFlow = {
                recipient: 'platform',
                autoTransfer: true,
                transferOnCompletion: true,
                commission: {
                    platform: platformCommission,
                    provider: providerAmount,
                    percentage: 10
                }
            };
        }

        spinner.classList.remove('d-none');

        // Enhanced payment payload with automation
        const payload = {
            amount: paymentAmount,
            paymentType: paymentType,
            paymentFlow: paymentFlow,
            bookingId: bookingData.bookingId || null,
            automation: {
                depositToPlatform: paymentType === 'advance',
                splitOnCompletion: paymentType === 'final',
                autoProviderPayout: paymentType === 'final',
                commissionDeduction: paymentType === 'final' ? 10 : 0, // 10% platform commission
                transferDelay: 0 // Immediate transfer after work completion
            },
            splitDetails: paymentType === 'final' ? {
                totalAmount: paymentAmount,
                platformCommission: paymentFlow.commission.platform,
                providerAmount: paymentFlow.commission.provider,
                providerId: serviceData.providerId,
                providerBankDetails: serviceData.providerBankDetails || null,
                autoTransferEnabled: true
            } : null,
            bookingData: paymentType === 'advance' ? {
                serviceId: serviceData.serviceId,
                providerId: serviceData.providerId,
                date: bookingData.date,
                address: bookingData.detailedAddress,
                notes: bookingData.notes,
                cost: serviceData.customCost,
                estimatedRange: serviceData.priceRange || `₹${serviceData.customCost - 100}-₹${serviceData.customCost + 100}`
            } : null,
            platformConfig: {
                accountId: userData.platformAccountId,
                webhookUrl: `${window.location.origin}/webhooks/payment`,
                returnUrl: `${window.location.origin}/booking/success`,
                cancelUrl: `${window.location.origin}/booking/cancel`
            }
        };

        console.log('Automated payment payload:', payload);

        const { data: orderData } = await axios({
            method: 'post',
            url: `/payment/${paymentType === 'advance' ? 'create-advance-order' : 'create-final-order'}`,
            data: payload,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!orderData.success) {
            throw new Error(orderData.error || 'Failed to create automated payment order');
        }

        // Hide spinner and enable button after successful order creation
        spinner.classList.add('d-none');
        payButton.disabled = false;

        // Update displayed amount
        const amountDisplay = document.getElementById('payment-amount');
        if (amountDisplay) {
            amountDisplay.textContent = formatCurrency(paymentAmount);
        }

        // Show payment flow information
        displayPaymentFlow(paymentType, paymentAmount, paymentFlow);

        // Configure Razorpay with enhanced options
        const options = {
            key: userData.razorpayKeyId,
            amount: paymentAmount * 100, // In paise
            currency: 'INR',
            name: 'KnockNFix',
            description: description,
            order_id: orderData.orderId,
            image: '/img/logo.png',
            prefill: {
                name: userData.name,
                email: userData.email,
                contact: userData.phone || ''
            },
            notes: {
                payment_type: paymentType,
                booking_id: bookingData.bookingId,
                provider_id: serviceData.providerId,
                automation_enabled: 'true'
            },
            handler: async function (response) {
                try {
                    await handlePaymentSuccess(response, orderData, paymentType, paymentFlow);
                } catch (error) {
                    handlePaymentError(error);
                }
            },
            modal: {
                ondismiss: function () {
                    resetPaymentButton();
                    console.log('Payment modal closed by user');
                }
            },
            theme: {
                color: '#3182ce'
            }
        };

        // Add click handler for payment button
        payButton.addEventListener('click', function () {
            this.disabled = true;

            try {
                const rzp = new Razorpay(options);
                rzp.open();
            } catch (err) {
                console.error('Error opening Razorpay:', err);
                alert('Could not initialize payment. Please try again.');
                this.disabled = false;
            }
        });

    } catch (error) {
        console.error('Payment initialization failed:', error);
        handleInitializationError(error);
    }
});


async function handlePaymentSuccess(response, orderData, paymentType, paymentFlow) {
    const payButton = document.getElementById('rzp-button');
    let spinner = payButton ? payButton.querySelector('.spinner-border') : null;

    // Show processing state - create spinner if it doesn't exist
    if (payButton) {
        payButton.disabled = true;

        if (!spinner) {
            // Create spinner if it doesn't exist
            spinner = document.createElement('span');
            spinner.className = 'spinner-border spinner-border-sm me-2';
            spinner.setAttribute('role', 'status');
            spinner.setAttribute('aria-hidden', 'true');
        } else {
            spinner.classList.remove('d-none');
        }

        payButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Processing Automated Payment...';
    }

    const verifyPayload = {
        orderId: orderData.orderId,
        bookingId: orderData.bookingId,
        paymentType: paymentType,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
        automationSettings: {
            depositToPlatform: paymentType === 'advance',
            splitOnCompletion: paymentType === 'final',
            providerPayoutEnabled: true,
            commissionRate: paymentType === 'final' ? 10 : 0,
            autoTransferOnWorkCompletion: paymentType === 'final'
        },
        paymentFlow: paymentFlow
    };

    const { data: verifyData } = await axios.post('/payment/verify-automated', verifyPayload);

    if (verifyData.success && verifyData.redirectUrl) {
        console.log('Automated payment processed successfully');

        // Log automation details
        if (paymentType === 'advance') {
            console.log('✅ Deposit Payment Automation:', {
                amount: verifyData.depositDetails.amount,
                platformAccount: verifyData.depositDetails.platformAccount,
                status: 'Deposited to platform account',
                holdUntilCompletion: true
            });
        }

        if (paymentType === 'final' && verifyData.automationSetup) {
            console.log('✅ Final Payment Automation Setup:', {
                totalAmount: verifyData.automationSetup.totalAmount,
                platformCommission: verifyData.automationSetup.platformCommission,
                providerAmount: verifyData.automationSetup.providerAmount,
                autoTransferScheduled: verifyData.automationSetup.autoTransferScheduled,
                transferTrigger: 'work_completion'
            });
        }

        // Show success message with automation info
        displayAutomationSuccess(paymentType, verifyData);

        // Redirect after short delay to show automation info
        setTimeout(() => {
            window.location.href = verifyData.redirectUrl;
        }, 2000);

    } else {
        throw new Error(verifyData.error || 'Automated payment verification failed');
    }
}

// Handle payment errors
function handlePaymentError(error) {
    console.error('Payment verification failed:', error);

    let errorMessage = 'Payment verification failed. Please try again.';
    if (error.response && error.response.data && error.response.data.error) {
        errorMessage = `Payment error: ${error.response.data.error}`;
    }

    alert(errorMessage);
    resetPaymentButton();
}

// Handle initialization errors
function handleInitializationError(error) {
    console.log('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
    });

    let errorMessage = 'Failed to initialize automated payment. Please try again.';
    if (error.response && error.response.status) {
        if (error.response.status === 404) {
            errorMessage = 'Payment service not available. Please try again later.';
        } else if (error.response.status === 400) {
            errorMessage = 'Invalid payment data. Please check your details and try again.';
        }
    }

    alert(errorMessage);
    resetPaymentButton();
}

function resetPaymentButton() {
    const payButton = document.getElementById('rzp-button');

    if (!payButton) {
        console.warn('Payment button not found');
        return;
    }

    const spinner = payButton.querySelector('.spinner-border');

    if (spinner) {
        spinner.classList.add('d-none');
    }

    payButton.disabled = false;

    // Restore original button text
    try {
        const paymentTypeElement = document.getElementById('payment-type');
        const serviceDataElement = document.getElementById('service-data');

        if (!serviceDataElement) {
            payButton.innerHTML = 'Pay Now';
            return;
        }

        const paymentType = paymentTypeElement?.value || 'advance';
        const serviceData = JSON.parse(serviceDataElement.value);
        const amount = paymentType === 'advance'
            ? Math.round(serviceData.customCost * 0.15)
            : serviceData.customCost - Math.round(serviceData.customCost * 0.15);

        payButton.innerHTML = `Pay ${formatCurrency(amount)} Now`;
    } catch (error) {
        console.error('Error resetting button text:', error);
        payButton.innerHTML = 'Pay Now';
    }
}

// Display payment flow information
function displayPaymentFlow(paymentType, amount, paymentFlow) {
    const flowInfo = document.getElementById('payment-flow-info');
    if (!flowInfo) return;

    let flowHtml = '';

    if (paymentType === 'advance') {
        flowHtml = `
            <div class="automation-info">
                <h6><i class="fas fa-robot me-2"></i>Automated Deposit Flow</h6>
                <div class="flow-step">
                    <i class="fas fa-arrow-right text-primary"></i>
                    <span>Payment goes directly to platform account</span>
                </div>
                <div class="flow-step">
                    <i class="fas fa-lock text-warning"></i>
                    <span>Funds held until service completion</span>
                </div>
            </div>
        `;
    } else {
        const commission = paymentFlow.commission;
        flowHtml = `
            <div class="automation-info">
                <h6><i class="fas fa-robot me-2"></i>Automated Final Payment Flow</h6>
                <div class="flow-step">
                    <i class="fas fa-arrow-right text-primary"></i>
                    <span>Platform Commission: ${formatCurrency(commission.platform)} (10%)</span>
                </div>
                <div class="flow-step">
                    <i class="fas fa-arrow-right text-success"></i>
                    <span>Provider Amount: ${formatCurrency(commission.provider)} (90%)</span>
                </div>
                <div class="flow-step">
                    <i class="fas fa-clock text-info"></i>
                    <span>Auto-transfer to provider after work completion</span>
                </div>
            </div>
        `;
    }

    flowInfo.innerHTML = flowHtml;
}

function displayAutomationSuccess(paymentType, verifyData) {
    const successDiv = document.createElement('div');
    successDiv.className = 'automation-success alert alert-success';
    successDiv.innerHTML = `
        <h6><i class="fas fa-check-circle me-2"></i>Automated Payment Successful!</h6>
        <p class="mb-0">
            ${paymentType === 'advance'
            ? 'Deposit has been automatically processed to platform account'
            : 'Payment automation has been set up for provider payout after work completion'}
        </p>
    `;

    const paymentSection = document.querySelector('.payment-section');
    if (paymentSection) {
        paymentSection.appendChild(successDiv);
    } else {
        // Fallback - append to body or a container
        const container = document.querySelector('.container') || document.body;
        container.appendChild(successDiv);
    }
}

// Helper function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0
    }).format(amount);
}