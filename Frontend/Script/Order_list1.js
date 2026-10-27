let selectedPayment = null;

        function updateOrderDetails(tierData) {
            const tiers = {
                'scholar': { name: 'Scholar', price: 299, tax: 53.82, total: 352.82 },
                'mentor': { name: 'Mentor', price: 699, tax: 125.82, total: 824.82 },
                'academician': { name: 'Academician', price: 1299, tax: 233.82, total: 1532.82 },
                'explorer': { name: 'Explorer', price: 0, tax: 0, total: 0 }
            };

            const tier = tiers[tierData?.toLowerCase()] || tiers['scholar'];
            
            document.getElementById('tierName').textContent = tier.name;
            document.getElementById('tierDisplay').textContent = tier.name;
            document.getElementById('monthlyFee').textContent = tier.price > 0 ? `₹${tier.price}` : 'Free';
            document.getElementById('gst').textContent = tier.tax > 0 ? `₹${tier.tax}` : 'N/A';
            document.getElementById('totalAmount').textContent = tier.total > 0 ? `₹${tier.total}` : 'Free Forever';
        }

        function generateOrderId() {
            const randomNum = Math.floor(Math.random() * 10000000);
            return `SC-2026-${randomNum}`;
        }

        function setDateTime() {
            const now = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            const dateStr = now.toLocaleDateString('en-US', options);
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            document.getElementById('orderDate').textContent = dateStr;
            document.getElementById('orderTime').textContent = timeStr + ' IST';
            document.getElementById('orderId').textContent = generateOrderId();
        }

        function selectPayment(method) {
            selectedPayment = method;
            
            // Remove active class from all options
            document.querySelectorAll('.payment-option').forEach(option => {
                option.classList.remove('active');
            });
            
            // Remove active class from all input boxes
            document.querySelectorAll('.payment-input-box').forEach(box => {
                box.classList.remove('active');
            });
            
            // Add active class to selected option
            event.target.closest('.payment-option').classList.add('active');
            
            // Show corresponding input box
            const boxId = method + 'Box';
            document.getElementById(boxId).classList.add('active');
        }

        // Terms checkbox handler
        document.getElementById('termsCheckbox').addEventListener('change', function() {
            document.getElementById('proceedBtn').disabled = !this.checked;
        });

        function proceedPayment() {
            if (!selectedPayment) {
                alert('Please select a payment method');
                return;
            }
            
            if (!document.getElementById('termsCheckbox').checked) {
                alert('Please accept Terms and Conditions');
                return;
            }

            alert(`Payment proceeding with ${selectedPayment.toUpperCase()}...\n\nThis is a mock sprint demo.`);
        }

        window.addEventListener('DOMContentLoaded', function() {
            setDateTime();
            const params = new URLSearchParams(window.location.search);
            const tier = params.get('tier') || 'scholar';
            updateOrderDetails(tier);
        });