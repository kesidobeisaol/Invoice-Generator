document.addEventListener('DOMContentLoaded', () => {
    const formPage = document.getElementById('formPage');
    const invoicePage = document.getElementById('invoicePage');
    const invoiceOutput = document.getElementById('invoiceOutput');
    const invoiceForm = document.getElementById('invoiceForm');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const tasksBody = document.getElementById('tasksBody');
    const backToFormBtn = document.getElementById('backToFormBtn');
    const printInvoiceBtn = document.getElementById('printInvoiceBtn');
    const invoiceDate = document.getElementById('invoiceDate');
    const paymentQrFile = document.getElementById('paymentQrFile');
    const paymentQrFileName = document.getElementById('paymentQrFileName');

    let paymentQrDataUrl = '';

    invoiceDate.value = new Date().toISOString().slice(0, 10);

    function nextIndex() {
        return tasksBody.querySelectorAll('.task-row').length;
    }

    function renumberRows() {
        tasksBody.querySelectorAll('.task-row').forEach((row, index) => {
            row.querySelectorAll('input, textarea').forEach((field) => {
                field.name = field.name.replace(/tasks\[\d+\]/, `tasks[${index}]`);
            });
        });
    }

    function createTaskRow(index) {
        const row = document.createElement('tr');
        row.className = 'task-row';
        row.innerHTML = `
            <td><input type="text" name="tasks[${index}][date]" placeholder="Apr 18, 2026" required></td>
            <td><input type="text" name="tasks[${index}][month]" placeholder="April" required></td>
            <td><input type="number" name="tasks[${index}][day]" placeholder="18" required></td>
            <td><textarea name="tasks[${index}][details]" rows="4" placeholder="Describe the task or activity performed..." required></textarea></td>
            <td><input type="number" name="tasks[${index}][hours]" placeholder="0" min="0" step="0.25" required></td>
            <td><button type="button" class="icon-btn remove-row" title="Remove row">×</button></td>
        `;
        return row;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function formatMoney(amount, currency) {
        return `${escapeHtml(currency.toUpperCase())} ${Number(amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    function formatDate(dateValue) {
        const date = new Date(dateValue + 'T00:00:00');
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: '2-digit'
        });
    }

    function clientCode(clientName) {
        const clean = String(clientName || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
        return clean ? clean.slice(0, Math.min(5, Math.max(3, clean.length))) : 'CLIENT';
    }

    function invoiceNumber(dateValue, clientName) {
        const date = new Date(dateValue + 'T00:00:00');
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `INV-${y}${m}${d}-${clientCode(clientName)}-001`;
    }

    function getValue(formData, key) {
        return formData.get(key)?.toString().trim() || '';
    }

    function addressLine(city, country, postal) {
        const location = [city, country].filter(Boolean).join(', ');
        return `${location}${postal ? ' ' + postal : ''}`.trim();
    }

    function optionalLine(value) {
        return value ? `<p>${escapeHtml(value)}</p>` : '';
    }

    function paymentDetailRow(label, value) {
        return value ? `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>` : '';
    }

    function renderPaymentSection(paymentInfo) {
        const { bankName, accountName, accountNumber, paymentReference, qrImage } = paymentInfo;
        const hasDetails = bankName || accountName || accountNumber || paymentReference;
        const hasQr = Boolean(qrImage);

        if (!hasDetails && !hasQr) return '';

        return `
            <section class="payment-section">
                <div class="payment-section-header">
                    <h3>Payment Details</h3>
                    <p>Please use the bank details or scan the QR code below.</p>
                </div>
                <div class="payment-section-grid ${hasQr ? '' : 'single-column'}">
                    <div class="payment-details-card">
                        ${paymentDetailRow('Bank Name', bankName)}
                        ${paymentDetailRow('Account Name', accountName)}
                        ${paymentDetailRow('Account Number', accountNumber)}
                        ${paymentDetailRow('Reference', paymentReference)}
                    </div>
                    ${hasQr ? `<div class="payment-qr-card"><img src="${escapeHtml(qrImage)}" alt="Payment QR code" class="payment-qr-image"></div>` : ''}
                </div>
            </section>
        `;
    }

    function getTasks() {
        const rows = tasksBody.querySelectorAll('.task-row');

        return Array.from(rows).map((row) => ({
            date: row.querySelector('[name$="[date]"]').value.trim(),
            details: row.querySelector('[name$="[details]"]').value.trim(),
            hours: Number(row.querySelector('[name$="[hours]"]').value || 0)
        })).filter((task) => task.date || task.details || task.hours > 0);
    }

    paymentQrFile.addEventListener('change', (event) => {
        const [file] = event.target.files || [];
        if (!file) {
            paymentQrDataUrl = '';
            paymentQrFileName.textContent = 'No file selected.';
            return;
        }

        paymentQrFileName.textContent = file.name;

        const reader = new FileReader();
        reader.onload = () => {
            paymentQrDataUrl = typeof reader.result === 'string' ? reader.result : '';
        };
        reader.readAsDataURL(file);
    });

    addTaskBtn.addEventListener('click', () => {
        tasksBody.appendChild(createTaskRow(nextIndex()));
    });

    tasksBody.addEventListener('click', (event) => {
        if (!event.target.classList.contains('remove-row')) return;

        const rows = tasksBody.querySelectorAll('.task-row');
        if (rows.length === 1) {
            alert('At least one task row is required.');
            return;
        }

        event.target.closest('.task-row').remove();
        renumberRows();
    });

    invoiceForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!invoiceForm.checkValidity()) {
            invoiceForm.reportValidity();
            return;
        }

        const formData = new FormData(invoiceForm);

        const freelancerName = getValue(formData, 'freelancer_name');
        const freelancerAddress = getValue(formData, 'freelancer_address');
        const freelancerCity = getValue(formData, 'freelancer_city');
        const freelancerCountry = getValue(formData, 'freelancer_country');
        const freelancerPostal = getValue(formData, 'freelancer_postal');
        const freelancerEmail = getValue(formData, 'freelancer_email');
        const freelancerPhone = getValue(formData, 'freelancer_phone');

        const clientName = getValue(formData, 'client_name');
        const clientAddress = getValue(formData, 'client_address');
        const clientCity = getValue(formData, 'client_city');
        const clientCountry = getValue(formData, 'client_country');
        const clientPostal = getValue(formData, 'client_postal');
        const clientContact = getValue(formData, 'client_contact');
        const clientEmail = getValue(formData, 'client_email');

        const invoiceDateValue = getValue(formData, 'invoice_date');
        const hourlyRate = Number(getValue(formData, 'hourly_rate') || 0);
        const currency = getValue(formData, 'currency') || 'PHP';
        const bankName = getValue(formData, 'bank_name');
        const accountName = getValue(formData, 'account_name');
        const accountNumber = getValue(formData, 'account_number');
        const paymentReference = getValue(formData, 'payment_reference');
        const tasks = getTasks();

        let totalHours = 0;

        const taskRows = tasks.map((task) => {
            const amount = task.hours * hourlyRate;
            totalHours += task.hours;

            return `
                <tr>
                    <td class="date-cell">${escapeHtml(task.date)}</td>
                    <td class="details-cell">${escapeHtml(task.details).replace(/\n/g, '<br>')}</td>
                    <td class="num">${task.hours.toFixed(2)}</td>
                    <td class="num">${formatMoney(hourlyRate, currency)}</td>
                    <td class="num">${formatMoney(amount, currency)}</td>
                </tr>
            `;
        }).join('');

        const grossAmount = totalHours * hourlyRate;
        const withholdingTax = grossAmount * 0.05;
        const netAmount = grossAmount - withholdingTax;

        const invNumber = invoiceNumber(invoiceDateValue, clientName);
        const freelancerLocation = addressLine(freelancerCity, freelancerCountry, freelancerPostal);
        const clientLocation = addressLine(clientCity, clientCountry, clientPostal);

        invoiceOutput.innerHTML = `
            <header class="invoice-header">
                <div class="invoice-brand-left">
                    <div class="invoice-icon" aria-hidden="true">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <div>
                        <h1>Invoice</h1>
                    </div>
                </div>
                <div class="invoice-company">
                    <h2>${escapeHtml(freelancerName)}</h2>
                    ${optionalLine(freelancerAddress)}
                    ${optionalLine(freelancerLocation)}
                    ${optionalLine(freelancerEmail)}
                    ${optionalLine(freelancerPhone)}
                </div>
            </header>

            <section class="invoice-meta-grid">
                <div>
                    <p class="label">Bill To</p>
                    <h3>${escapeHtml(clientName)}</h3>
                    ${optionalLine(clientContact)}
                    ${optionalLine(clientAddress)}
                    ${optionalLine(clientLocation)}
                    ${optionalLine(clientEmail)}
                </div>
                <div class="invoice-meta-card">
                    <div>
                        <span>Invoice Number</span>
                        <strong>${escapeHtml(invNumber)}</strong>
                    </div>
                    <div>
                        <span>Invoice Date</span>
                        <strong>${escapeHtml(formatDate(invoiceDateValue))}</strong>
                    </div>
                    <div>
                        <span>Currency</span>
                        <strong>${escapeHtml(currency.toUpperCase())}</strong>
                    </div>
                </div>
            </section>

            <section class="invoice-table-section">
                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Activity Details</th>
                            <th class="num">Estimated Hours</th>
                            <th class="num">Hourly Rate</th>
                            <th class="num">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${taskRows}
                    </tbody>
                </table>
            </section>

            <section class="totals-section no-note">
                <div></div>
                <div class="totals-card">
                    <div>
                        <span>Total Hours</span>
                        <strong>${totalHours.toFixed(2)}</strong>
                    </div>
                    <div>
                        <span>Gross Amount</span>
                        <strong>${formatMoney(grossAmount, currency)}</strong>
                    </div>
                    <div>
                        <span>5% Withholding Tax</span>
                        <strong>-${formatMoney(withholdingTax, currency)}</strong>
                    </div>
                    <div class="grand-total">
                        <span>Net Amount After Withholding</span>
                        <strong>${formatMoney(netAmount, currency)}</strong>
                    </div>
                </div>
            </section>

            <footer class="invoice-footer">
                ${renderPaymentSection({ bankName, accountName, accountNumber, paymentReference, qrImage: paymentQrDataUrl })}
                <p>Thank you for your business.</p>
            </footer>
        `;

        formPage.hidden = true;
        invoicePage.hidden = false;
        document.body.className = 'invoice-bg';
        window.scrollTo(0, 0);
    });

    backToFormBtn.addEventListener('click', () => {
        invoicePage.hidden = true;
        formPage.hidden = false;
        document.body.className = 'app-bg';
        window.scrollTo(0, 0);
    });

    printInvoiceBtn.addEventListener('click', () => {
        window.print();
    });
});
