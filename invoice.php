<?php
session_start();

function h($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function money($amount, $currency) {
    return h(strtoupper($currency)) . ' ' . number_format((float)$amount, 2);
}

function address_line($city, $country, $postal) {
    $city = trim((string)$city);
    $country = trim((string)$country);
    $postal = trim((string)$postal);

    $location = trim(implode(', ', array_filter([$city, $country], fn($part) => $part !== '')));
    return trim($location . ($postal !== '' ? ' ' . $postal : ''));
}

function client_code($clientName) {
    $clean = preg_replace('/[^A-Za-z0-9]/', '', (string)$clientName);
    $clean = strtoupper($clean);

    if ($clean === '') {
        return 'CLIENT';
    }

    return substr($clean, 0, min(5, max(3, strlen($clean))));
}

function invoice_sequence($dateKey, $clientCode) {
    if (!isset($_SESSION['invoice_sequences'])) {
        $_SESSION['invoice_sequences'] = [];
    }

    $key = $dateKey . '-' . $clientCode;

    if (!isset($_SESSION['invoice_sequences'][$key])) {
        $_SESSION['invoice_sequences'][$key] = 1;
    }

    return str_pad((string)$_SESSION['invoice_sequences'][$key], 3, '0', STR_PAD_LEFT);
}

function uploaded_qr_data_url() {
    if (
        !isset($_FILES['payment_qr_file']) ||
        !is_array($_FILES['payment_qr_file']) ||
        ($_FILES['payment_qr_file']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE
    ) {
        return '';
    }

    if ($_FILES['payment_qr_file']['error'] !== UPLOAD_ERR_OK) {
        return '';
    }

    $maxSize = 3 * 1024 * 1024;

    if ($_FILES['payment_qr_file']['size'] > $maxSize) {
        return '';
    }

    $tmpPath = $_FILES['payment_qr_file']['tmp_name'];

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($tmpPath);

    $allowed = [
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
    ];

    if (!in_array($mime, $allowed, true)) {
        return '';
    }

    $content = file_get_contents($tmpPath);

    if ($content === false) {
        return '';
    }

    return 'data:' . $mime . ';base64,' . base64_encode($content);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.html');
    exit;
}

$freelancerName = $_POST['freelancer_name'] ?? '';
$freelancerAddress = $_POST['freelancer_address'] ?? '';
$freelancerCity = $_POST['freelancer_city'] ?? '';
$freelancerCountry = $_POST['freelancer_country'] ?? '';
$freelancerPostal = $_POST['freelancer_postal'] ?? '';
$freelancerEmail = $_POST['freelancer_email'] ?? '';
$freelancerPhone = $_POST['freelancer_phone'] ?? '';

$clientName = $_POST['client_name'] ?? '';
$clientAddress = $_POST['client_address'] ?? '';
$clientCity = $_POST['client_city'] ?? '';
$clientCountry = $_POST['client_country'] ?? '';
$clientPostal = $_POST['client_postal'] ?? '';
$clientContact = $_POST['client_contact'] ?? '';
$clientEmail = $_POST['client_email'] ?? '';

$invoiceDateRaw = $_POST['invoice_date'] ?? date('Y-m-d');
$invoiceTimestamp = strtotime($invoiceDateRaw) ?: time();
$invoiceDateDisplay = date('F d, Y', $invoiceTimestamp);
$dateKey = date('Ymd', $invoiceTimestamp);

$hourlyRate = (float)($_POST['hourly_rate'] ?? 0);
$currency = $_POST['currency'] ?? 'PHP';
$tasks = $_POST['tasks'] ?? [];

$paymentBankName = trim($_POST['payment_bank_name'] ?? '');
$paymentAccountName = trim($_POST['payment_account_name'] ?? '');
$paymentAccountNumber = trim($_POST['payment_account_number'] ?? '');
$paymentNotes = trim($_POST['payment_notes'] ?? '');

$paymentQrData = uploaded_qr_data_url();

if ($paymentQrData === '') {
    $hiddenQrData = trim($_POST['payment_qr_data'] ?? '');

    if (preg_match('/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i', $hiddenQrData)) {
        $paymentQrData = $hiddenQrData;
    }
}

$clientCode = client_code($clientName);
$seq = invoice_sequence($dateKey, $clientCode);
$invoiceNumber = 'INV-' . $dateKey . '-' . $clientCode . '-' . $seq;

$totalHours = 0;
$preparedTasks = [];

foreach ($tasks as $task) {
    $date = trim($task['date'] ?? '');
    $details = trim($task['details'] ?? '');
    $hours = (float)($task['hours'] ?? 0);

    if ($date === '' && $details === '' && $hours <= 0) {
        continue;
    }

    $amount = $hours * $hourlyRate;
    $totalHours += $hours;

    $preparedTasks[] = [
        'date' => $date,
        'details' => $details,
        'hours' => $hours,
        'rate' => $hourlyRate,
        'amount' => $amount,
    ];
}

$subtotal = $totalHours * $hourlyRate;
$withholdingRate = 0.05;
$withholdingTax = $subtotal * $withholdingRate;
$netAmount = $subtotal - $withholdingTax;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= h($invoiceNumber) ?></title>
    <link rel="stylesheet" href="style.css">
</head>
<body class="invoice-bg">
    <main class="invoice-page">
        <div class="invoice-actions no-print">
            <a href="index.html" class="btn secondary">Back to Form</a>
            <button onclick="window.print()" class="btn primary">Print / Save as PDF</button>
        </div>

        <section class="invoice-sheet">
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
                    <h2><?= h($freelancerName) ?></h2>
                    <?php if (trim($freelancerAddress) !== ''): ?><p><?= h($freelancerAddress) ?></p><?php endif; ?>

                    <?php $freelancerLocation = address_line($freelancerCity, $freelancerCountry, $freelancerPostal); ?>
                    <?php if ($freelancerLocation !== ''): ?><p><?= h($freelancerLocation) ?></p><?php endif; ?>

                    <?php if ($freelancerEmail !== ''): ?><p><?= h($freelancerEmail) ?></p><?php endif; ?>
                    <?php if ($freelancerPhone !== ''): ?><p><?= h($freelancerPhone) ?></p><?php endif; ?>
                </div>
            </header>

            <section class="invoice-meta-grid">
                <div>
                    <p class="label">Bill To</p>
                    <h3><?= h($clientName) ?></h3>

                    <?php if ($clientContact !== ''): ?><p><?= h($clientContact) ?></p><?php endif; ?>
                    <?php if (trim($clientAddress) !== ''): ?><p><?= h($clientAddress) ?></p><?php endif; ?>

                    <?php $clientLocation = address_line($clientCity, $clientCountry, $clientPostal); ?>
                    <?php if ($clientLocation !== ''): ?><p><?= h($clientLocation) ?></p><?php endif; ?>

                    <?php if ($clientEmail !== ''): ?><p><?= h($clientEmail) ?></p><?php endif; ?>
                </div>

                <div class="invoice-meta-card">
                    <div>
                        <span>Invoice Number</span>
                        <strong><?= h($invoiceNumber) ?></strong>
                    </div>
                    <div>
                        <span>Invoice Date</span>
                        <strong><?= h($invoiceDateDisplay) ?></strong>
                    </div>
                    <div>
                        <span>Currency</span>
                        <strong><?= h(strtoupper($currency)) ?></strong>
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
                        <?php foreach ($preparedTasks as $task): ?>
                            <tr>
                                <td class="date-cell"><?= h($task['date']) ?></td>
                                <td class="details-cell"><?= nl2br(h($task['details'])) ?></td>
                                <td class="num"><?= number_format((float)$task['hours'], 2) ?></td>
                                <td class="num"><?= money($task['rate'], $currency) ?></td>
                                <td class="num"><?= money($task['amount'], $currency) ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </section>

            <section class="totals-section">
                <div class="payment-box">
                    <p class="label">Payment / Notes</p>

                    <?php if ($paymentBankName !== ''): ?>
                        <p><strong>Bank / Wallet:</strong> <?= h($paymentBankName) ?></p>
                    <?php endif; ?>

                    <?php if ($paymentAccountName !== ''): ?>
                        <p><strong>Account Name:</strong> <?= h($paymentAccountName) ?></p>
                    <?php endif; ?>

                    <?php if ($paymentAccountNumber !== ''): ?>
                        <p><strong>Account Number:</strong> <?= h($paymentAccountNumber) ?></p>
                    <?php endif; ?>

                    <?php if ($paymentNotes !== ''): ?>
                        <p class="payment-note-text"><?= nl2br(h($paymentNotes)) ?></p>
                    <?php endif; ?>

                    <?php if ($paymentBankName === '' && $paymentAccountName === '' && $paymentAccountNumber === '' && $paymentNotes === '' && $paymentQrData === ''): ?>
                        <p class="payment-note-text">Payment details to be provided separately.</p>
                    <?php endif; ?>

                    <?php if ($paymentQrData !== ''): ?>
                        <div class="payment-qr-box">
                            <img src="<?= h($paymentQrData) ?>" alt="Payment QR Code" class="payment-qr-image">
                        </div>
                    <?php endif; ?>
                </div>

                <div class="totals-card">
                    <p class="label summary-label">Summary</p>
                    <div>
                        <span>Total Hours</span>
                        <strong><?= number_format((float)$totalHours, 2) ?></strong>
                    </div>
                    <div>
                        <span>Gross Amount</span>
                        <strong><?= money($subtotal, $currency) ?></strong>
                    </div>
                    <div>
                        <span>5% Withholding Tax</span>
                        <strong>-<?= money($withholdingTax, $currency) ?></strong>
                    </div>
                    <div class="grand-total">
                        <span>Net Amount After Withholding</span>
                        <strong><?= money($netAmount, $currency) ?></strong>
                    </div>
                </div>
            </section>

            <footer class="invoice-footer">
                <p>Thank you for your business.</p>
            </footer>
        </section>
    </main>
</body>
</html>
