document.addEventListener('DOMContentLoaded', async function () {
    try {
        const payButton = document.getElementById('rzp-button');
        const spinner = payButton.querySelector('.spinner-border');

        // Parse data from hidden inputs
        const bookingData = JSON.parse(document.getElementById('booking-data').value);
        const userData = JSON.parse(document.getElementById('user-data').value);
        const serviceData = JSON.parse(document.getElementById('service-data').value);

        // Calculate advance amount
        const advanceAmount = Math.round(serviceData.customCost * 0.1);

        spinner.classList.remove('d-none');

        // Create request payload
        const payload = {
            amount: advanceAmount,
            bookingData: {
                serviceId: serviceData.serviceId,
                providerId: serviceData.providerId,
                date: bookingData.date,
                address: bookingData.detailedAddress,
                notes: bookingData.notes,
                cost: serviceData.customCost
            }
        };

        console.log('Sending payload:', payload); // Debug log

        const { data: orderData } = await axios({
            method: 'post',
            url: '/payment/create-order',
            data: payload,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!orderData.success) {
            throw new Error(orderData.error || 'Failed to create order');
        }

        spinner.classList.add('d-none');
        payButton.disabled = false;

        // Configure Razorpay
        const options = {
            key: userData.razorpayKeyId,
            amount: advanceAmount * 100,
            currency: 'INR',
            name: 'KnockNFix',
            description: 'Booking Advance Payment',
            order_id: orderData.orderId,
            image: '/img/logo.png',
            prefill: {
                name: userData.name,
                email: userData.email,
                contact: userData.phone || ''
            },
            handler: async function (response) {
                try {
                    spinner.classList.remove('d-none');
                    payButton.disabled = true;

                    const { data: verifyData } = await axios.post('/payment/verify', {
                        orderId: orderData.orderId,
                        bookingId: orderData.bookingId,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_signature: response.razorpay_signature
                    });

                    if (verifyData.success && verifyData.redirectUrl) {
                        console.log('Redirecting to:', verifyData.redirectUrl); // Debug log
                        window.location.href = verifyData.redirectUrl;
                    } else {
                        throw new Error(verifyData.error || 'Payment verification failed');
                    }
                } catch (error) {
                    console.error('Payment verification failed:', error);
                    alert('Payment verification failed. Please try again.');
                    spinner.classList.add('d-none');
                    payButton.disabled = false;
                }
            },
            modal: {
                ondismiss: function () {
                    spinner.classList.add('d-none');
                    payButton.disabled = false;
                }
            },
            theme: {
                color: '#3182ce'
            }
        };

        // Add click handler for payment button
        payButton.addEventListener('click', function () {
            const rzp = new Razorpay(options);
            rzp.open();
        });

    } catch (error) {
        console.error('Payment initialization failed:', error);
        console.log('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        alert('Failed to initialize payment. Please try again.');
    }
});