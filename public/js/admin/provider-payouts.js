document.addEventListener('DOMContentLoaded', function () {
    // Process payout button handler
    document.querySelectorAll('.process-payout-btn').forEach(button => {
        button.addEventListener('click', function () {
            const providerId = this.getAttribute('data-provider-id');
            const providerName = this.getAttribute('data-provider-name');
            const amount = this.getAttribute('data-amount');

            document.getElementById('providerIdInput').value = providerId;
            document.getElementById('providerNameDisplay').value = providerName;
            document.getElementById('payoutAmountDisplay').value = amount;

            // Reset form
            document.getElementById('transactionReference').value = '';
            document.getElementById('payoutNotes').value = '';

            // Show form, hide success/error
            document.querySelector('.process-payout-form').classList.remove('d-none');
            document.querySelector('.process-payout-form-footer').classList.remove('d-none');
            document.querySelector('.process-payout-success').classList.add('d-none');
            document.querySelector('.process-payout-success-footer').classList.add('d-none');
            document.querySelector('.process-payout-error').classList.add('d-none');
            document.querySelector('.process-payout-error-footer').classList.add('d-none');
        });
    });

    // Confirm payout button handler
    document.getElementById('confirmPayoutBtn').addEventListener('click', async function () {
        const providerId = document.getElementById('providerIdInput').value;
        const transactionReference = document.getElementById('transactionReference').value;
        const notes = document.getElementById('payoutNotes').value;

        if (!transactionReference) {
            alert('Transaction reference is required');
            return;
        }

        // Show loading state
        const spinner = this.querySelector('.spinner-border');
        spinner.classList.remove('d-none');
        this.disabled = true;

        try {
            const response = await fetch(`/admin/process-payout/${providerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ transactionReference, notes })
            });

            const data = await response.json();

            if (data.success) {
                // Show success message
                document.querySelector('.process-payout-form').classList.add('d-none');
                document.querySelector('.process-payout-form-footer').classList.add('d-none');
                document.querySelector('.process-payout-success').classList.remove('d-none');
                document.querySelector('.process-payout-success-footer').classList.remove('d-none');
                document.querySelector('.payout-success-message').textContent = data.message;

                // Reload after closing
                const modal = bootstrap.Modal.getInstance(document.getElementById('processPayoutModal'));
                modal._element.addEventListener('hidden.bs.modal', function () {
                    window.location.reload();
                });
            } else {
                throw new Error(data.message || 'Failed to process payout');
            }
        } catch (error) {
            // Show error message
            document.querySelector('.process-payout-form').classList.add('d-none');
            document.querySelector('.process-payout-form-footer').classList.add('d-none');
            document.querySelector('.process-payout-error').classList.remove('d-none');
            document.querySelector('.process-payout-error-footer').classList.remove('d-none');
            document.querySelector('.payout-error-message').textContent = error.message;
        } finally {
            // Reset button
            spinner.classList.add('d-none');
            this.disabled = false;
        }
    });

    // Retry button handler
    document.getElementById('retryPayoutBtn').addEventListener('click', function () {
        document.querySelector('.process-payout-form').classList.remove('d-none');
        document.querySelector('.process-payout-form-footer').classList.remove('d-none');
        document.querySelector('.process-payout-error').classList.add('d-none');
        document.querySelector('.process-payout-error-footer').classList.add('d-none');
    });

    // Verify bank details handler
    document.querySelectorAll('.verify-bank-btn').forEach(button => {
        button.addEventListener('click', async function () {
            const providerId = this.getAttribute('data-provider-id');
            console.log("Verifying bank details for provider:", providerId);

            try {
                button.disabled = true;
                button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Verifying...';

                // Log the request URL
                console.log("Sending POST request to:", `/admin/verify-bank-details/${providerId}`);

                const response = await fetch(`/admin/verify-bank-details/${providerId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                // Log the response status
                console.log("Response status:", response.status);

                const data = await response.json();
                console.log("Response data:", data);

                if (data.success) {
                    // Show success toast
                    const toast = document.createElement('div');
                    toast.className = 'toast align-items-center text-white bg-success border-0 position-fixed bottom-0 end-0 m-3';
                    toast.setAttribute('role', 'alert');
                    toast.setAttribute('aria-live', 'assertive');
                    toast.setAttribute('aria-atomic', 'true');
                    toast.style.zIndex = '9999';

                    toast.innerHTML = `
                    <div class="d-flex">
                        <div class="toast-body">
                            <i class="fas fa-check-circle me-2"></i> Bank details verified successfully
                        </div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" 
                            aria-label="Close"></button>
                    </div>
                    `;

                    document.body.appendChild(toast);

                    const bsToast = new bootstrap.Toast(toast, {
                        delay: 3000
                    });
                    bsToast.show();

                    // Reload page after toast is hidden
                    toast.addEventListener('hidden.bs.toast', function () {
                        window.location.reload();
                    });
                } else {
                    throw new Error(data.message || 'Failed to verify bank details');
                }
            } catch (error) {
                alert('Error: ' + error.message);
                console.error('Error verifying bank details:', error);
            } finally {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-check me-1"></i> Verify Bank';
            }
        });
    });

    // Export report handler
    document.getElementById('exportReportBtn').addEventListener('click', function () {
        // In a real implementation, this would trigger a server request to generate the export
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        const statuses = [...document.querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);

        // Show quick toast
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-primary border-0 position-fixed bottom-0 end-0 m-3';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.style.zIndex = '9999';

        toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas fa-info-circle me-2"></i> Generating report. Download will start soon.
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" 
                aria-label="Close"></button>
        </div>
        `;

        document.body.appendChild(toast);

        const bsToast = new bootstrap.Toast(toast, {
            delay: 3000
        });
        bsToast.show();

        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('exportModal')).hide();

        // In a real implementation, you would navigate to a download URL or initiate a download
        console.log('Export params:', { startDate, endDate, format, statuses });
    });
});