const buttons = document.querySelectorAll('.cta-button');
        
        buttons.forEach(button => {
            button.addEventListener('click', function() {
                const tierName = this.closest('.membership-page').querySelector('.tier-title').textContent;
                const price = this.closest('.membership-page').querySelector('.price-amount').textContent;
                const designation = this.closest('.membership-page').querySelector('.tier-badge-top').textContent;
                
                if (this.classList.contains('free')) {
                    alert(`✨ Welcome to StudyCircle!\n\nYou have entered as: ${tierName}\n\n"Every great scholar once took their first step. Welcome to the circle."\n\nYour journey of discovery begins now. Explore our communities, connect with fellow learners, and discover your path to excellence.`);
                } else {
                    alert(`🏛️ Ascension Initiated\n\n${designation}\n${tierName} Tier\n\nInvestment: ${price}/month\n\nProceed to unlock the deeper chambers of our scholarly citadel...`);
                }
            });
        });