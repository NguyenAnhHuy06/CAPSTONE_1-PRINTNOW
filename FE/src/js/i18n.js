// FE/js/i18n.js
(function () {
  const KEY = "lang";
  const DICT = {
    en: {
      // ===== Register page =====
      "register.page_title": "PrintNow - Sign Up",
      "register.heading_prefix": "Get Started with",
      "register.subtext": "Create your free account",
      "register.placeholder_fullname": "Your Full Name",
      "register.placeholder_email": "Your Email Address",
      "register.placeholder_phone": "Your Phone Number",
      "register.placeholder_password": "Create a Strong Password",
      "register.button": "Sign Up",
      "register.have_account": "Already have an account?",
      "register.login": "Login",
      "register.success":
        "Sign up successful! Please check your email for the OTP.",
      "register.failed": "Registration failed",

      // ===== Login page =====
      "login.page_title": "Login | PrintNow",
      "login.welcome": "Welcome back!",
      "login.subtext": "Login to your account",
      "login.placeholder_email": "Email Address",
      "login.placeholder_password": "Password",
      "login.button": "Login",
      "login.recover": "Recover Password",
      "login.no_account": "Don't have an account?",
      "login.signup": "Sign Up",
      "login.success": "Logged in successfully!",
      "login.failed": "Login failed",
      "login.redirecting": "You're already logged in. Redirecting...",

      /* ===== Forgot Password ===== */
      "forgot.title": "Forgot Password",
      "forgot.desc":
        "Enter your registered email to receive an OTP for password reset.",
      "placeholder.email": "Enter your email",
      "pw.sending_otp": "Sending...",
      "pw.otp_sent_ok": "OTP has been sent to your email.",
      "alert.network_error":
        "Cannot connect to server. Please check your network.",

      "title.setting": "Setting",
      "subtitle.setting": "Manage account and interface preferences",

      "section.password.title": "Change Password",
      "section.password.desc": "Update your password to secure your account",
      "label.current_password": "Current password",
      "label.new_password": "New password",
      "label.confirm_password": "Confirm new password",
      "placeholder.current_password": "Enter current password",
      "placeholder.new_password": "Enter new password (minimum 6 characters)",
      "placeholder.confirm_password": "Re-enter new password",
      "btn.change_password": "Change Password",

      "section.language.title": "Language",
      "section.language.desc": "Select interface display language",
      "label.language": "Language",
      "note.language_applied": "Language changes will be applied immediately.",
      "btn.save_settings": "Save Settings",

      // ===== Employee Settings page =====
      "employee_settings.account_heading": "Account Settings",
      "employee_settings.btn_update": "Update",
      "employee_settings.label_first_name": "First Name",
      "employee_settings.label_last_name": "Last Name",
      "employee_settings.label_email": "Email",
      "employee_settings.label_phone": "Phone Number",
      "employee_settings.label_address": "Address",
      "employee_settings.label_city": "City",
      "employee_settings.label_country": "Country",
      "employee_settings.placeholder_first_name": "Enter the first name",
      "employee_settings.placeholder_last_name": "Enter the last name",
      "employee_settings.placeholder_email": "Enter your email",
      "employee_settings.placeholder_phone": "802345678",
      "employee_settings.placeholder_address": "254 Nguyen Van Linh",
      "employee_settings.placeholder_city": "Da Nang",

      // ===== New Password page =====
      "setpw.page_title": "Set New Password",
      "setpw.title": "Set New Password",
      "setpw.desc": "Create a new password to secure your account.",
      "setpw.placeholder_new": "New Password",
      "setpw.placeholder_confirm": "Confirm New Password",
      "setpw.btn_confirm": "Confirm",
      "setpw.processing": "Processing...",
      "setpw.success": "Password has been reset successfully!",
      "setpw.failed": "Password reset failed",
      "setpw.err_empty": "Please fill in both fields.",
      "setpw.err_mismatch": "Passwords do not match!",
      "setpw.err_policy":
        "Password must be ≥8 chars, include an uppercase letter and a number.",
      "setpw.err_token": "Missing reset token. Please request OTP again.",

      /* ===== OTP Verify page ===== */
      "otp.page_title": "Email Verification",
      "otp.title": "Email Verification",
      "otp.subtitle": "Enter the 6-digit code sent to your email",
      "otp.subtitle_email":
        "Enter the 6-digit code sent to <strong>{email}</strong>",
      "otp.resend": "Resend Code",
      "otp.verify": "Verify",
      "otp.error_invalid": "Invalid code. Please try again.",
      "otp.error_fill6": "Please enter all 6 digits.",
      "otp.error_missing_email": "Email not found. Please try again.",
      "otp.error_generic": "Something went wrong. Please try again.",
      "otp.resend_ok": "A new OTP has been sent.",
      "otp.resend_fail": "Could not resend OTP. Please try again later.",
      "otp.alert_verified": "Verification successful! You can now log in.",

      // alerts
      "alert.load_settings_failed": "Cannot load settings",
      "alert.save_ok": "Saved!",
      "alert.save_failed": "Save failed",
      "alert.lang_reload": "Saved! Reloading to apply language...",
      "alert.pw_mismatch": "New passwords do not match!",
      "alert.pw_minlen": "Password must be at least 6 characters.",
      "alert.pw_ok": "Password changed successfully",
      "alert.pw_fail": "Password change failed",
      "alert.generic_error": "Something went wrong. Please try again.",
      "pw.send_otp": "Send OTP",
      "a11y.toggle_password": "Toggle password visibility",
      "alert.invalid_email": "Invalid email. Please check again.",
      "alert.missing_customer_info": "Please enter your Full Name and Email.",
      "alert.session_expired":
        "Login session has expired. Please log in again.",
      "alert.create_order_failed": "Failed to create order. Please try again.",
      "alert.file_too_large":
        'File "{name}" exceeds {max}MB. Please choose a smaller file.',
      "alert.file_type_not_supported": 'Format "{type}" is not supported.',

      /* ===== Auth Header ===== */
      "header.profile": "Profile",
      "header.order_history": "Order history",
      "header.settings": "Setting",
      "header.logout": "Log Out",
      "header.user_menu": "User menu",
      "header.fallback_user": "User",

      // ===== Global / Header / Footer =====
      "common.cancel": "Cancel",
      "nav.tagline": "Print service",
      "nav.home": "Home",
      "nav.services": "Services",
      "nav.about": "About Us",
      "nav.login": "Login",
      "footer.copyright": "© 2024 PrintNow. All rights reserved.",

      // About Us page
      "about.hero_title": "PrintNow - Comprehensive Printing Solutions",
      "about.hero_subtitle":
        "With over 50 years of experience in the printing industry, we pride ourselves on being a trusted partner for all your printing needs. From custom designs to mass production, we are committed to providing the best quality at competitive prices.",
      "about.achievements_title": "Our Achievements",
      "about.achievements_subtitle":
        "Impressive numbers affirm prestige and quality",
      "about.metric_years_label": "Years of Experience",
      "about.metric_years_desc": "Providing specialized services",
      "about.metric_customers_label": "Valued Customers",
      "about.metric_customers_desc": "From large enterprises to individuals",
      "about.metric_tech_label": "Modern Tech System",
      "about.metric_tech_desc": "Applying the newest equipment",
      "about.metric_quality_label": "Commitment to Quality",
      "about.metric_quality_desc": "Absolute confidence and satisfaction",

      "about.services_title": "Detailed Services",
      "about.services_subtitle": "Explore our professional services",

      // services cards
      "about.service_doc_title": "Print Documents",
      "about.service_doc_desc":
        "Reports, school documents, and theses with high quality",
      "about.service_doc_bullet1": "Beautiful & color printing",
      "about.service_doc_bullet2": "Diverse paper choices",
      "about.service_doc_bullet3": "Professional finishing",

      "about.service_photo_title": "Print Photo",
      "about.service_photo_desc":
        "Memories, decorative photos, art photos with vivid colors",
      "about.service_photo_bullet1": "Various photo sizes",
      "about.service_photo_bullet2": "Color correction",
      "about.service_photo_bullet3": "Impressive frame",

      "about.service_card_title": "Print Business Card",
      "about.service_card_desc":
        "Unique design and professional printing from your design",
      "about.service_card_bullet1": "Diverse materials",
      "about.service_card_bullet2": "Design support",
      "about.service_card_bullet3": "High quality",

      "about.service_cup_title": "Print Cups",
      "about.service_cup_desc":
        "Logos and custom designs on paper cups and plastic cups",
      "about.service_cup_bullet1": "Diverse sizes",
      "about.service_cup_bullet2": "Sharp colors",
      "about.service_cup_bullet3": "Minimum print",

      "about.contact_title": "Contact Information",
      "about.contact_subtitle": "Visit our store or contact us",
      "about.contact_block_title": "Address & Contact",
      "about.contact_store_label": "Store address",
      "about.contact_store_value": "123 Nguyen Van Linh, Da Nang, Viet Nam",
      "about.contact_hotline_label": "Hotline",
      "about.contact_hotline_value": "0236 3888 888",
      "about.contact_email_label": "Email",
      "about.contact_email_value": "info@printnow.com",
      "about.contact_working_label": "Working Hours",
      "about.contact_working_monfri": "Monday - Friday: 08:00 - 18:00",
      "about.contact_working_sat": "Saturday: 09:00 - 14:00",
      "about.contact_working_sun": "Sunday: Closed",

      "about.location_map": "Location Map",

      "about.map_title_inner": "Google Maps",
      "about.map_subtitle_inner": "[Maps API Integration]",

      "about.testimonials_title": "What Customers Say",
      "about.testimonials_subtitle": "Genuine reviews from customers",
      "about.testimonial_1":
        '"Great service and high quality prints. Highly recommend for any business."',
      "about.testimonial_2":
        '"I came here to print some photos, and I\'m very satisfied with the colors and quality."',
      "about.testimonial_3":
        '"Fast delivery, professional staff. I will continue to use the service here."',

      "about.cta_title": "Ready to Experience the Service?",
      "about.cta_subtitle":
        "Let us help you realize your printing ideas with the best quality and professional service.",
      "about.cta_order": "Order now",
      "about.cta_inquire": "Inquire now",

      // ===== Home page =====
      "home.hero_title": "Professional Printing Services",
      "home.hero_subtitle":
        "From office documents to photo printing, business cards and drinks – we offer comprehensive printing solutions with high quality and competitive prices.",
      "home.hero_order": "Order now",
      "home.hero_learn_more": "Learn more",

      "home.services_title": "Professional Printing Services",
      "home.services_subtitle":
        "Discover a wide range of printing services, from basic to advanced, to meet all your needs.",

      "home.service_doc_title": "Print Documents",
      "home.service_doc_desc":
        "Print office documents, theses, reports with high quality",
      "home.service_doc_tag1": "Black/White & Color printing",
      "home.service_doc_tag2": "2-sided printing",
      "home.service_doc_tag3": "Various paper sizes",
      "home.service_doc_price": "From 2.000đ/page",

      "home.service_photo_title": "Print Photo",
      "home.service_photo_desc":
        "High-quality photo printing available in a wide range of sizes and finishes",
      "home.service_photo_tag1": "Multiple sizes",
      "home.service_photo_tag2": "Premium paper",
      "home.service_photo_tag3": "Vibrant colors",
      "home.service_photo_price": "From 5.000đ/photo",

      "home.service_card_title": "Print Name Card",
      "home.service_card_desc":
        "Professional Business Card Printing from Your Design",
      "home.service_card_tag1": "High-quality paper",
      "home.service_card_tag2": "Beautiful finish",
      "home.service_card_tag3": "Flexible quantity",
      "home.service_card_price": "From 100.000đ/box",

      "home.service_cup_title": "Print Cups",
      "home.service_cup_desc":
        "Print logos and designs on paper cups and plastic cups",
      "home.service_cup_tag1": "Paper & plastic cups",
      "home.service_cup_tag2": "Beautiful finish",
      "home.service_cup_tag3": "Reasonable price",
      "home.service_cup_price": "From 2.000đ/cup",

      "home.view_all_services": "View all services",

      "home.why_title": "Why Choose Us?",
      "home.why_subtitle":
        "With many years of experience and modern technology, we are committed to providing the best service",
      "home.why_fast_title": "Fast",
      "home.why_fast_desc": "Fast printing time, on-time delivery",
      "home.why_quality_title": "Quality",
      "home.why_quality_desc": "Using modern machinery, quality guaranteed",
      "home.why_cred_title": "Credibility",
      "home.why_cred_desc": "Many years of experience in the printing industry",
      "home.why_support_title": "24/7 Support",
      "home.why_support_desc":
        "Professional consulting team, support at all times",

      "home.cta_title": "Ready to Get Started?",
      "home.cta_subtitle":
        "Let us help you print high quality products with dedicated service",
      "home.cta_order": "Order now",

      "home.footer_hours_title": "Working Hours",
      "home.footer_hours_line1": "Mon - Fri: 8:00 - 18:00",
      "home.footer_hours_line2": "Saturday: 8:00 - 16:00",
      "home.footer_hours_line3": "Sunday: 9:00 - 15:00",

      "home.footer_services_title": "Services",
      "home.footer_services_line1": "Print Name Card",
      "home.footer_services_line2": "Document Print",
      "home.footer_services_line3": "Photo Print",
      "home.footer_services_line4": "Packaging Print",

      "home.footer_copyright": "© 2025 All rights reserved.",

      // ===== Service Print page =====
      "service.print_title": "Printing Service",
      "service.print_subtitle": "Choose the service that suits your needs",

      "service.doc_title": "Print Document",
      "service.doc_desc": "Print PDF, Word, PowerPoint files with many options",
      "service.doc_feature1": "Black White & Color",
      "service.doc_feature2": "Thesis Binding",
      "service.doc_feature3": "Multiple Paper Sizes",
      "service.doc_feature4": "Double-Sided Printing",
      "service.doc_price": "500 VND/page",

      "service.photo_title": "Print Photos",
      "service.photo_desc": "Print high quality photos in a variety of sizes",
      "service.photo_feature1": "Various Sizes",
      "service.photo_feature2": "High Quality",
      "service.photo_feature3": "Glossy/Matte Paper",
      "service.photo_feature4": "Color Correction",
      "service.photo_price": "5,000 VND/Photo",

      "service.card_title": "Print business cards",
      "service.card_desc":
        "Professional Business Card Printing from Your Design",
      "service.card_feature1": "From Your Design",
      "service.card_feature2": "Fast Printing",
      "service.card_feature3": "Various Paper Types",
      "service.card_feature4": "High Quality",
      "service.card_price": "200,000 VND/box",

      "service.cup_title": "Print Cups",
      "service.cup_desc":
        "Print logos and designs on paper cups and plastic cups",
      "service.cup_feature1": "Paper & Plastic Cups",
      "service.cup_feature2": "Large Quantity",
      "service.cup_feature3": "Logo/Design Printing",
      "service.cup_feature4": "Business Use",
      "service.cup_price": "2,000 VND/cup",

      "service.price_from": "Price from",
      "service.select_btn": "Select service",

      "service.help_title": "Need help?",
      "service.help_subtitle": "Contact us for detailed advice on the service",
      "service.contact_hotline": "Hotline: 1900169874",
      "service.contact_email": "Email: print@gmail.com",

      "service.footer_desc": "Fast & reliable printing services.",
      "service.footer_copyright": "© 2025 PrintNow",

      // ===== Notification page =====
      "notif.bell_title": "Notifications",
      "notif.back_title": "Go back",
      "notif.title": "Notification",
      "notif.subtitle": "Track order status and important notifications",

      "notif.btn_mark_all": "Mark all read",
      "notif.btn_delete_read": "Delete read",
      "notif.btn_mark_read": "Mark read",
      "notif.btn_delete": "Delete",

      "notif.unread_suffix": "unread",
      "notif.tag_important": "Important",
      "notif.load_error": "Cannot load notifications.",
      "notif.empty": "No notifications yet.",

      "notif.time_just_now": "just now",
      "notif.time_minutes_ago": "{n} minutes ago",
      "notif.time_hours_ago": "{n} hours ago",
      "notif.time_days_ago": "{n} days ago",

      // ===== Order details page =====
      "order.title": "Order Details",
      "order.subtitle": "Review full information of your order.",
      "order.box_order_info": "Order Info",
      "order.box_customer": "Customer",
      "order.field_order_id": "Order ID",
      "order.field_date": "Date",
      "order.field_status": "Status",
      "order.field_reason": "Reason",
      "order.field_name": "Name",
      "order.field_email": "Email",
      "order.table_product": "Product",
      "order.table_quantity": "Quantity",
      "order.table_unit_price": "Unit Price",
      "order.table_total": "Total",
      "order.table_note": "Note",
      "order.table_file_upload": "File Upload",
      "order.summary_subtotal": "Subtotal",
      "order.summary_adjustment": "Adjustment",
      "order.summary_total": "Total",
      "order.btn_reorder": "Reorder",
      "order.btn_cancel": "Cancel",
      "order.btn_return": "Return",
      "order.status_completed": "Completed",
      "order.status_processing": "Processing",
      "order.status_cancelled": "Cancelled",
      "order.status_pending": "Pending",
      "orders.status_cancelled": "Cancelled",

      // ===== Orders Dashboard – Create Order Modal =====
      "orders.create_title": "Create New Order",
      "orders.form_select_customer": "Select Customer",
      "orders.form_customer_placeholder": "Enter customer name or phone...",
      "orders.form_payment_type": "Payment Type",
      "orders.payment_in_store": "In Store",
      "orders.payment_online": "Payment Online",
      "orders.form_order_type": "Order Type",
      "orders.form_choose_type": "Choose type",
      "orders.form_order_status": "Order Status",
      "orders.form_order_datetime": "Order Time & Date",
      "orders.form_pages_estimated": "Pages (estimated)",
      "orders.form_pages_placeholder": "e.g. 10",
      "orders.form_copies": "Copies",
      "orders.form_copies_placeholder": "e.g. 2",
      "orders.form_unit_price": "Unit Price (₫)",
      "orders.form_order_note": "Order Note",
      "orders.form_order_note_placeholder": "Add note (optional)...",
      "orders.btn_create_order_submit": "Create Order",
      "orders.tooltip_cancelled_order": "Order has been cancelled",
      "order.cancel_confirm": "Are you sure you want to cancel this order?",
      "order.cancel_reason_placeholder": "Cancel reason (optional):",
      "order.cancel_failed": "Could not cancel the order. Please try again.",
      "order.cancel_success": "Order has been cancelled.",

      // ===== Order history page =====
      "order_history.title": "Order History",
      "order_history.subtitle":
        "View your past orders and check their status easily",
      "order_history.filter_all": "All",
      "order_history.filter_pending": "Pending",
      "order_history.filter_completed": "Completed",
      "order_history.filter_processing": "Processing",
      "order_history.filter_cancelled": "Cancelled",
      "order_history.caption": "Your order history with status and totals",
      "order_history.th_order_id": "Order ID",
      "order_history.th_date": "Date",
      "order_history.th_status": "Status",
      "order_history.th_total": "Total",
      "order_history.th_action": "Action",
      "order_history.btn_view": "View",
      "order_history.btn_reorder": "Reorder",
      "order_history.btn_cancel": "Cancel",
      "order_history.reorder_not_allowed_cancelled":
        "Cancelled orders cannot be reordered.",
      "order_history.reorder_login_required": "Please log in again to reorder.",
      "order_history.reorder_no_items":
        "No items found in this order to reorder.",
      "order_history.reorder_failed": "Could not reorder. Please try again.",

      // ===== Order payment page =====
      "order_payment.page_title": "Order Payment",
      "order_payment.loading": "Loading order details...",
      "order_payment.title": "Order payment",
      "order_payment.subtitle": "Choose the appropriate payment method",
      "order_payment.section_info_title": "Payment Information",
      "order_payment.label_order_code": "Order code:",
      "order_payment.label_quantity": "Quantity:",
      "order_payment.label_total": "Total Order Value:",
      "order_payment.deposit_title": "50% deposit required",
      "order_payment.deposit_desc":
        "Orders over 100.000 VND require 50% prepayment",
      "order_payment.deposit_pay_now_label": "Amount to be paid immediately:",
      "order_payment.deposit_cod_label": "Cash on delivery:",
      "order_payment.section_method_title": "Payment method",
      "order_payment.method_store_title": "Pay at store",
      "order_payment.method_store_desc": "Pay in person when picking up",
      "order_payment.method_vnpay_title": "Pay online via VnPay",
      "order_payment.method_vnpay_desc": "Pay the entire amount online",
      "order_payment.method_recommended": "Recommended",
      "order_payment.section_qr_title": "QR Code payment",
      "order_payment.qr_waiting": "Waiting for payment...",
      "order_payment.qr_helper":
        "Use banking apps or e-wallets that support VnPay",
      "order_payment.summary_title": "Order Summary",
      "order_payment.summary_total_label": "Total:",
      "order_payment.summary_pay_now_label": "Pay now:",
      "order_payment.btn_confirm_store": "Confirm payment at the store",
      "order_payment.btn_confirm_vnpay": "I have paid via VnPay",
      "order_payment.benefit_time": "Completion time: 2-5 business days",
      "order_payment.benefit_email": "Email notification upon completion",

      // ===== Order status page =====
      "order_status.page_title": "Order Status",
      "order_status.title": "Order status",
      "order_status.subtitle": "Track the progress of your order",
      "order_status.progress_label": "Order progress",
      "order_status.summary_title": "Order Summary",
      "order_status.summary_total": "Total:",
      "order_status.summary_paid": "Paid:",
      "order_status.summary_remaining": "Remaining Amount:",
      "order_status.summary_order_code": "Order code",
      "order_status.details_title": "Order details",
      "order_status.field_order_code": "Order code",
      "order_status.field_order_date": "Order date",
      "order_status.field_service": "Services",
      "order_status.field_expected": "Expected completion",
      "order_status.field_quantity": "Quantity",
      "order_status.field_payment_method": "Payment method",
      "order_status.step1_title": "Order received",
      "order_status.step1_desc": "The order has been received and confirmed.",
      "order_status.step2_title": "Processing",
      "order_status.step2_desc": "Preparing files and checking quality",
      "order_status.step3_title": "Printing",
      "order_status.step3_desc": "Printing on demand in progress",
      "order_status.step4_title": "Quality Control",
      "order_status.step4_desc": "Final Product Quality Control",
      "order_status.step5_title": "Ready to ship/receive",
      "order_status.step5_desc": "Product is completed, ready to ship",
      "order_status.step6_title": "Completed",
      "order_status.step6_desc": "Order successfully completed",
      "order_status.alert_not_found":
        "Order data not found! Please go back to the confirmation page.",

      // ===== Order confirmation page =====
      "order_confirm.page_title": "Order Confirmation | PrintNow",
      "order_confirm.title": "Order Confirmation",
      "order_confirm.subtitle":
        "Review your order details before proceeding to payment",
      "order_confirm.service_title_doc": "Document Printing",
      "order_confirm.service_title_photo": "Photo Printing",
      "order_confirm.customer_info_title": "Customer Information",
      "order_confirm.file_list_title_doc": "List of Documents to Print",
      "order_confirm.file_list_title_photo": "List of Photos to Print",
      "order_confirm.label_order_code": "Order code:",
      "order_confirm.file_detail_page": "page",
      "order_confirm.file_detail_pages": "pages",
      "order_confirm.file_detail_copy": "copy",
      "order_confirm.file_detail_copies": "copies",
      "order_confirm.file_detail_photo": "photo",
      "order_confirm.file_detail_photos": "photos",
      "order_confirm.file_detail_side_single": "Single-sided",
      "order_confirm.file_detail_side_double": "Double-sided",
      "order_confirm.file_detail_borderless": "Borderless",
      "order_confirm.file_detail_bound": "Bound",
      "order_confirm.file_detail_cover": "Cover Page",
      "order_confirm.file_detail_mode_bw": "Black & White",
      "order_confirm.file_detail_mode_color": "Color",
      "order_confirm.special_requests_title": "Special Requests",
      "order_confirm.summary_title": "Order Summary",
      "order_confirm.summary_count_label": "Number of Documents:",
      "order_confirm.summary_total_label": "Total:",
      "order_confirm.btn_proceed_payment": "Proceed to Payment",
      "order_confirm.count_docs_singular": "document",
      "order_confirm.count_docs_plural": "documents",
      "order_confirm.count_photos_singular": "photo",
      "order_confirm.count_photos_plural": "photos",

      // ===== Personal profile page =====
      "profile.page_title": "Personal Profile | PrintNow",
      "profile.title": "Personal Profile",
      "profile.subtitle": "Manage your account information",

      "profile.role_customer": "Customer",
      "profile.joined_prefix": "Joined:",

      "profile.btn_edit": "Edit",
      "profile.btn_save": "Save",

      "profile.section_info_title": "Personal Information",
      "profile.section_info_desc": "Update your contact information",

      "profile.field_full_name": "Full Name",
      "profile.field_email": "Email",
      "profile.field_phone": "Phone number",
      "profile.field_address": "Address",

      "profile.btn_edit": "Edit",

      "profile.activity_title": "Activity Statistics",
      "profile.stat_total": "Total Orders",
      "profile.stat_completed": "Completed",
      "profile.stat_inprogress": "In Progress",
      "profile.stat_cancelled": "Cancelled",

      "profile.avatar_title": "Avatar",
      "profile.avatar_helper":
        "Choose a new image to update (PNG/JPG/GIF/WEBP ≤ 5MB)",
      "profile.avatar_btn_cancel": "Cancel",
      "profile.avatar_btn_upload": "Upload",

      // extra benefit for confirmation page
      "order_payment.benefit_payment_support":
        "Support for in-store and online payment",

      // ===== Print photo page =====
      "print_photo.page_title": "Print Photos",
      "print_photo.title": "High Quality Photo Printing",
      "print_photo.subtitle":
        "Upload your photo and choose size and paper type",
      "print_photo.customer_info_title": "Customer Information",
      "print_photo.upload_section_title": "Upload image",
      "print_photo.upload_main": "Select a photo to print",
      "print_photo.upload_helper":
        "Supports JPG, PNG, TIFF (up to 20MB per image, minimum resolution 300 DPI)",
      "print_photo.upload_button": "Select file",
      "print_photo.special_request_title": "Special request",
      "print_photo.special_request_label": "Additional notes (optional)",
      "print_photo.special_request_placeholder":
        "For example: crop to scale, adjust colors, deliver to a different address...",
      "print_photo.config_section_title": "Print configuration",
      "print_photo.label_paper_type": "Type of paper",
      "print_photo.borderless_label": "Borderless (10%)",
      "print_photo.footer_note_borderless":
        "The photo will be printed in full size, without any white borders around it.",
      "print_photo.summary_title": "Order Summary",
      "print_photo.summary_empty": "No file has been uploaded",
      "print_photo.summary_count_label": "Number of photos:",
      "print_photo.summary_total_label": "Total:",
      "print_photo.btn_proceed_payment": "Proceed to payment",
      "print_photo.btn_creating_order": "Creating order...",
      "print_photo.count_photos_singular": "photo",
      "print_photo.count_photos_plural": "photos",

      // ===== Print document page =====
      "print_doc.page_title": "Print Documents",
      "print_doc.title": "Print Documents",
      "print_doc.subtitle":
        "Upload files and configure print options for each file",
      "print_doc.customer_info_title": "Customer Information",
      "print_doc.field_full_name_label": "Full Name",
      "print_doc.field_full_name_placeholder": "Enter full name",
      "print_doc.field_email_label": "Email",
      "print_doc.field_email_placeholder": "Enter email",
      "print_doc.upload_section_title": "Upload file",
      "print_doc.upload_main": "Select file to print",
      "print_doc.upload_helper":
        "Supports PDF, DOC, DOCX, PPT, PPTX (max 10MB per file)",
      "print_doc.special_request_title": "Special request",
      "print_doc.special_request_placeholder":
        "For example: deliver before 2pm, print on thicker paper...",
      "print_doc.config_section_title": "Configure print files",
      "print_doc.label_copies": "Number of copies",
      "print_doc.label_paper_size": "Paper size",
      "print_doc.label_printed_sides": "Printed sides",
      "print_doc.label_print_mode": "Print mode",
      "print_doc.print_mode_bw": "Black & White",
      "print_doc.print_mode_color": "Color",
      "print_doc.print_mode_combination": "Combination (some coloring pages)",
      "print_doc.label_color_pages": "Pages to be printed in color",
      "print_doc.placeholder_color_pages": "E.g., 1, 3-5, 8, 10",
      "print_doc.label_document_type": "Document type",
      "print_doc.doc_type_regular": "Regular",
      "print_doc.doc_type_thesis": "Thesis/Report",
      "print_doc.binding_label": "Binding (5.000₫)",
      "print_doc.cover_label": "Cover Page (2.000₫)",
      "print_doc.summary_title": "Order Summary",
      "print_doc.summary_empty": "No files uploaded yet",
      "print_doc.summary_count_label": "Number of files:",
      "print_doc.summary_total_label": "Total:",
      "print_doc.btn_proceed_payment": "Proceed with payment",
      "print_doc.files_suffix": "files",
      "print_doc.alert_missing_customer":
        "Please enter your Full Name and Email.",
      "print_doc.btn_processing": "Processing...",
      "print_doc.alert_create_order_failed":
        "Failed to create order. Please try again.",

      // ===== Customers dashboard page =====
      "customers.page_title": "Customers",
      "customers.breadcrumb": "Customers",
      "customers.btn_add_customer": " Add a New Customer",
      "customers.summary_title": "Customers Summary",
      "customers.period_this_week": "This Week",
      "customers.period_this_month": "This Month",
      "customers.period_this_year": "This Year",
      "customers.card_total_customers": "All Customers",
      "customers.card_active_customers": "Active",
      "customers.card_inactive_customers": "In-Active",
      "customers.card_new_customers": "New Customers",
      "customers.card_purchasing_customers": "Purchasing",
      "customers.card_abandoned_carts": "Abandoned Carts",
      "customers.table_title": "Customer",
      "customers.search_placeholder": "Search",
      "customers.filter_button": "Filter",
      "customers.filter_title": "Filter",
      "customers.filter_status_label": "Status",
      "customers.filter_status_all": "All",
      "customers.filter_status_active": "Active",
      "customers.filter_status_inactive": "In-Active",
      "customers.filter_customer_label": "Customer",
      "customers.filter_customer_all": "All",
      "customers.filter_amount_label": "Amount",
      "customers.filter_amount_from": "From",
      "customers.filter_amount_to": "To",
      "customers.filter_amount_placeholder": "0.00",
      "customers.filter_apply_button": "Filter",
      "customers.date_filter_title": "By Date",
      "customers.date_filter_this_week": "This Week",
      "customers.date_filter_last_week": "Last Week",
      "customers.date_filter_this_month": "This Month",
      "customers.date_filter_last_month": "Last Month",
      "customers.date_filter_this_year": "This Year",
      "customers.date_filter_last_year": "Last Year",
      "customers.date_filter_custom": "Custom range",
      "customers.date_from_btn": "From",
      "customers.date_to_btn": "To",
      "customers.status_active": "Active",
      "customers.status_inactive": "In-Active",
      "customers.bulk_status_all": "Bulk Status",
      "customers.bulk_status_active": "Active",
      "customers.bulk_status_inactive": "In-Active",
      "customers.th_id": "Customer ID",
      "customers.th_name": "Customer Name",
      "customers.th_email": "Email",
      "customers.th_phone": "Phone",
      "customers.th_orders": "Orders",
      "customers.th_total": "Order Total",
      "customers.th_since": "Customer Since",
      "customers.th_status": "Status",
      "customers.pagination_per_page": "10 items per page",
      "customers.pagination_items": "1-10 of 200 items",
      "customers.pagination_pages": "1 of 44 pages",

      // ===== Orders Dashboard (Employee) =====
      "orders.page_title": "Orders Dashboard",
      "orders.breadcrumb": "Orders",
      "orders.btn_create_order": " Create a New Order",
      "orders.summary_title": "Orders Summary",
      "orders.card_all_orders": "All Orders",
      "orders.card_pending": "Pending",
      "orders.card_completed": "Completed",
      "orders.card_canceled": "Canceled",
      "orders.card_returned": "Returned",
      "orders.card_damaged": "Damaged",
      "orders.card_abandoned_cart": "Abandoned Cart",
      "orders.card_customers": "Customers",
      "orders.table_title": "Customer Orders",
      "orders.filter_order_type": "Order Type",
      "orders.order_type_document": "Print Document",
      "orders.order_type_photo": "Print Photo",
      "orders.order_type_card": "Print Card",
      "orders.order_type_cup": "Print Cup",
      "orders.bulk_action": "Bulk Action",
      "orders.th_order_type": "Order Type",

      // Reuse of existing period/date labels from Customers:
      // customers.period_this_week / _this_month / _this_year
      // customers.date_filter_* (this_week, last_week, ...)

      "orders.status_pending": "Pending",
      "orders.status_in_progress": "In-Progress",
      "orders.status_ready": "Ready",
      "orders.status_completed": "Completed",
      "orders.status_canceled": "Canceled",
      "orders.status_cancelled": "Cancelled",

      // ===== Customer Details (Employee) =====
      "customer_details.page_title": "Customer Details",
      "customer_details.breadcrumb_view": "View Customer",
      "customer_details.customer_id_label": "Customer ID",
      "customer_details.customer_since": "Customer Since",
      "customer_details.copied": "Copied!",
      "customer_details.btn_delete": "Delete Customer",
      "customer_details.card_basic_last_order": "Last Order",
      "customer_details.card_basic_phone": "Phone",
      "customer_details.card_basic_email": "Email",
      "customer_details.card_basic_no_orders": "No orders yet",
      "customer_details.card_basic_status_active": "Active",
      "customer_details.card_basic_status_inactive": "Inactive",
      "customer_details.card_address_title": "Home Address",
      "customer_details.card_address_empty": "No address",
      "customer_details.card_total_title": "Total Orders",
      "customer_details.card_total_filter_all": "All time",
      "customer_details.card_total_filter_month": "This month",
      "customer_details.section_orders_title": "{name} Orders",
      "customer_details.search_placeholder": "Search",
      "customer_details.filter_general_button": "Filter",
      "customer_details.filter_general_title": "Filter Options",
      "customer_details.filter_status_label": "Status",
      "customer_details.filter_status_all": "All",
      "customer_details.filter_status_pending": "Pending",
      "customer_details.filter_status_in_progress": "In-Progress",
      "customer_details.filter_status_ready": "Ready",
      "customer_details.filter_status_completed": "Completed",
      "customer_details.filter_status_cancelled": "Cancelled",
      "customer_details.filter_payment_label": "Payment Method",
      "customer_details.filter_payment_all": "All",
      "customer_details.filter_payment_online": "Online Payment",
      "customer_details.filter_payment_cod": "Cash on Delivery",
      "customer_details.filter_payment_direct": "Direct Payment",
      "customer_details.filter_apply": "Apply Filter",
      "customer_details.filter_date_button": "Filter",
      "customer_details.filter_date_title": "Filter by Date",
      "customer_details.filter_date_today": "Today",
      "customer_details.filter_date_this_week": "This Week",
      "customer_details.filter_date_this_month": "This Month",
      "customer_details.filter_date_last_month": "Last Month",
      "customer_details.filter_date_this_year": "This Year",
      "customer_details.filter_date_custom": "Custom Range",
      "customer_details.share_button": "Share",
      "customer_details.bulk_action_label": "Bulk Action",
      "customer_details.bulk_action_pending": "Pending",
      "customer_details.bulk_action_in_progress": "In-Progress",
      "customer_details.bulk_action_ready": "Ready",
      "customer_details.bulk_action_completed": "Completed",
      "customer_details.bulk_action_cancelled": "Cancelled",
      "customer_details.th_order_date": "Order Date",
      "customer_details.th_payment_method": "Payment Method",
      "customer_details.th_order_total": "Order Total",
      "customer_details.th_status": "Status",
      "customer_details.empty_message": "No orders match the current filters.",
      "customer_details.error_missing_id":
        "Customer ID not found. Please open this page from the customer list.",
      "customer_details.error_load_failed": "Unable to load customer details.",
      "customer_details.error_delete_failed": "Unable to delete customer.",
      "customer_details.error_generic": "An error occurred while loading data.",
      "customer_details.confirm_delete":
        "Are you sure you want to delete this customer?",
      "customer_details.delete_success": "Customer deleted successfully.",

      // ===== ADD into DICT.en =====
      // --- Auth / Owner Dashboard guards ---
      "auth.confirm_logout": "Are you sure you want to log out?",
      "auth.login_required": "Please log in to view the dashboard.",
      "auth.session_expired": "Session expired. Please log in again.",

      // --- Owner Dashboard (optional but recommended) ---
      "dashboard.title": "Dashboard",

      "dashboard.nav.dashboard": "Dashboard",
      "dashboard.nav.orders": "Orders",
      "dashboard.nav.customers": "Customers",
      "dashboard.nav.inventory": "Inventory",
      "dashboard.nav.settings": "Settings",
      "dashboard.nav.contact_support": "Contact Support",
      "dashboard.nav.logout": "Logout",

      "dashboard.kpi.sales": "Sales",
      "dashboard.kpi.volume": "Volume",
      "dashboard.kpi.customers": "Customers",
      "dashboard.kpi.active": "Active",

      "dashboard.marketing.title": "Marketing",
      "dashboard.marketing.acquisition": "Acquisition",
      "dashboard.marketing.purchase": "Purchase",
      "dashboard.marketing.retention": "Retention",
      "dashboard.marketing.center_customers": "Customers",

      "dashboard.products.all_products": "All Products",
      "dashboard.products.active": "Active",

      "dashboard.cart.abandoned_cart": "Abandoned Cart",
      "dashboard.cart.customers": "Customers",

      "dashboard.summary.title": "Summary",
      "dashboard.summary.sales": "Sales",

      "dashboard.recent_orders.title": "Recent Orders",
      "dashboard.recent_orders.product": "Product",
      "dashboard.recent_orders.unit_price": "Unit Price",
      "dashboard.recent_orders.qty": "Qty",
      "dashboard.recent_orders.discount": "Discount",
      "dashboard.recent_orders.total": "Total",

      "dashboard.time.today": "Today",
      "dashboard.time.this_week": "This Week",
      "dashboard.time.this_month": "This Month",
      "dashboard.time.last_7_days": "Last 7 Days",
      "dashboard.time.last_30_days": "Last 30 Days",

      // used in your JS for empty table
      "dashboard.no_recent_orders": "No recent orders yet."

    },
    vi: {
      // ===== Trang đăng ký =====
      "register.page_title": "PrintNow - Đăng ký",
      "register.heading_prefix": "Bắt đầu với",
      "register.subtext": "Tạo tài khoản miễn phí",
      "register.placeholder_fullname": "Họ và tên của bạn",
      "register.placeholder_email": "Địa chỉ email của bạn",
      "register.placeholder_phone": "Số điện thoại của bạn",
      "register.placeholder_password": "Tạo mật khẩu mạnh",
      "register.button": "Đăng ký",
      "register.have_account": "Đã có tài khoản?",
      "register.login": "Đăng nhập",
      "register.success":
        "Đăng ký thành công! Vui lòng kiểm tra email để nhận mã OTP.",
      "register.failed": "Đăng ký thất bại",

      // ===== Trang đăng nhập =====
      "login.page_title": "Đăng nhập | PrintNow",
      "login.welcome": "Chào mừng quay lại!",
      "login.subtext": "Đăng nhập vào tài khoản của bạn",
      "login.placeholder_email": "Địa chỉ email",
      "login.placeholder_password": "Mật khẩu",
      "login.button": "Đăng nhập",
      "login.recover": "Quên mật khẩu",
      "login.no_account": "Chưa có tài khoản?",
      "login.signup": "Đăng ký",
      "login.success": "Đăng nhập thành công!",
      "login.failed": "Đăng nhập thất bại",
      "login.failed": "Đăng nhập thất bại",

      /* ===== Quên mật khẩu ===== */
      "forgot.title": "Quên mật khẩu",
      "forgot.desc": "Nhập email đã đăng ký để nhận mã OTP đặt lại mật khẩu.",
      "placeholder.email": "Nhập email của bạn",
      "pw.sending_otp": "Đang gửi...",
      "pw.otp_sent_ok": "Mã OTP đã được gửi đến email của bạn.",
      "alert.network_error":
        "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.",

      "title.setting": "Cài đặt",
      "subtitle.setting": "Quản lý tài khoản và tuỳ chọn giao diện",

      "section.password.title": "Đổi mật khẩu",
      "section.password.desc": "Cập nhật mật khẩu để bảo vệ tài khoản",
      "label.current_password": "Mật khẩu hiện tại",
      "label.new_password": "Mật khẩu mới",
      "label.confirm_password": "Xác nhận mật khẩu mới",
      "placeholder.current_password": "Nhập mật khẩu hiện tại",
      "placeholder.new_password": "Nhập mật khẩu mới (ít nhất 6 ký tự)",
      "placeholder.confirm_password": "Nhập lại mật khẩu mới",
      "btn.change_password": "Đổi mật khẩu",

      "section.language.title": "Ngôn ngữ",
      "section.language.desc": "Chọn ngôn ngữ hiển thị giao diện",
      "label.language": "Ngôn ngữ",
      "note.language_applied": "Thay đổi ngôn ngữ sẽ áp dụng ngay.",
      "btn.save_settings": "Lưu cài đặt",

      // ===== Employee Settings page =====
      "employee_settings.account_heading": "Cài đặt tài khoản",
      "employee_settings.btn_update": "Cập nhật",
      "employee_settings.label_first_name": "Tên",
      "employee_settings.label_last_name": "Họ",
      "employee_settings.label_email": "Email",
      "employee_settings.label_phone": "Số điện thoại",
      "employee_settings.label_address": "Địa chỉ",
      "employee_settings.label_city": "Thành phố",
      "employee_settings.label_country": "Quốc gia",
      "employee_settings.placeholder_first_name": "Nhập tên",
      "employee_settings.placeholder_last_name": "Nhập họ",
      "employee_settings.placeholder_email": "Nhập email",
      "employee_settings.placeholder_phone": "802345678",
      "employee_settings.placeholder_address": "254 Nguyễn Văn Linh",
      "employee_settings.placeholder_city": "Đà Nẵng",

      // ===== Trang đặt mật khẩu mới =====
      "setpw.page_title": "Đặt mật khẩu mới",
      "setpw.title": "Đặt mật khẩu mới",
      "setpw.desc": "Tạo mật khẩu mới để bảo vệ tài khoản của bạn.",
      "setpw.placeholder_new": "Mật khẩu mới",
      "setpw.placeholder_confirm": "Xác nhận mật khẩu mới",
      "setpw.btn_confirm": "Xác nhận",
      "setpw.processing": "Đang xử lý...",
      "setpw.success": "Đặt lại mật khẩu thành công!",
      "setpw.failed": "Đặt lại mật khẩu thất bại",
      "setpw.err_empty": "Vui lòng điền đầy đủ hai ô.",
      "setpw.err_mismatch": "Mật khẩu không khớp!",
      "setpw.err_policy":
        "Mật khẩu phải ≥8 ký tự, gồm ít nhất 1 chữ hoa và 1 số.",
      "setpw.err_token": "Thiếu mã đặt lại mật khẩu. Vui lòng yêu cầu OTP lại.",

      /* ===== Trang OTP Verify ===== */
      "otp.page_title": "Xác thực email",
      "otp.title": "Xác thực email",
      "otp.subtitle": "Nhập mã 6 chữ số được gửi tới email của bạn",
      "otp.subtitle_email":
        "Nhập mã 6 chữ số được gửi tới <strong>{email}</strong>",
      "otp.resend": "Gửi lại mã",
      "otp.verify": "Xác thực",
      "otp.error_invalid": "Mã OTP không đúng. Vui lòng thử lại.",
      "otp.error_fill6": "Vui lòng nhập đủ 6 chữ số.",
      "otp.error_missing_email": "Không tìm thấy email. Vui lòng thao tác lại.",
      "otp.error_generic": "Có lỗi xảy ra. Vui lòng thử lại.",
      "otp.resend_ok": "Mã OTP mới đã được gửi.",
      "otp.resend_fail": "Không thể gửi lại OTP. Vui lòng thử sau.",
      "otp.alert_verified": "Xác thực thành công! Bạn đã có thể đăng nhập.",

      // alerts
      "alert.load_settings_failed": "Không thể tải cài đặt",
      "alert.save_ok": "Đã lưu!",
      "alert.save_failed": "Lưu thất bại",
      "alert.lang_reload": "Đã lưu! Đang tải lại để áp dụng ngôn ngữ...",
      "alert.pw_mismatch": "Mật khẩu mới không khớp!",
      "alert.pw_minlen": "Mật khẩu tối thiểu 6 ký tự.",
      "alert.pw_ok": "Đổi mật khẩu thành công",
      "alert.pw_fail": "Đổi mật khẩu thất bại",
      "alert.generic_error": "Có lỗi xảy ra. Vui lòng thử lại.",
      "pw.send_otp": "Gửi OTP",
      "a11y.toggle_password": "Bật/tắt hiển thị mật khẩu",
      "alert.invalid_email": "Email không hợp lệ. Vui lòng kiểm tra lại.",
      "alert.missing_customer_info": "Vui lòng nhập Họ và tên và Email.",
      "alert.session_expired":
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      "alert.create_order_failed": "Tạo đơn thất bại. Vui lòng thử lại.",
      "alert.file_too_large":
        'Tệp "{name}" vượt quá {max}MB. Vui lòng chọn tệp nhỏ hơn.',
      "alert.file_type_not_supported": 'Định dạng "{type}" chưa được hỗ trợ.',

      /* ===== Header xác thực ===== */
      "header.profile": "Hồ sơ",
      "header.order_history": "Lịch sử đơn hàng",
      "header.settings": "Cài đặt",
      "header.logout": "Đăng xuất",
      "header.user_menu": "Menu người dùng",
      "header.fallback_user": "Người dùng",

      // ===== Global / Header / Footer =====
      "common.cancel": "Hủy",
      "nav.tagline": "Dịch vụ in ấn",
      "nav.home": "Trang chủ",
      "nav.services": "Dịch vụ",
      "nav.about": "Giới thiệu",
      "nav.login": "Đăng nhập",
      "footer.copyright": "© 2024 PrintNow. Bản quyền đã được bảo lưu.",

      // About Us page
      "about.hero_title": "PrintNow - Giải pháp in ấn toàn diện",
      "about.hero_subtitle":
        "Với hơn 50 năm kinh nghiệm trong ngành in ấn, chúng tôi tự hào là đối tác tin cậy cho mọi nhu cầu in ấn của bạn. Từ thiết kế riêng đến in số lượng lớn, chúng tôi cam kết mang lại chất lượng tốt nhất với mức giá cạnh tranh.",
      "about.achievements_title": "Thành tựu của chúng tôi",
      "about.achievements_subtitle":
        "Những con số ấn tượng khẳng định uy tín và chất lượng",
      "about.metric_years_label": "Năm kinh nghiệm",
      "about.metric_years_desc": "Cung cấp dịch vụ chuyên nghiệp",
      "about.metric_customers_label": "Khách hàng tin tưởng",
      "about.metric_customers_desc": "Từ doanh nghiệp lớn đến khách lẻ",
      "about.metric_tech_label": "Hệ thống công nghệ hiện đại",
      "about.metric_tech_desc": "Ứng dụng thiết bị và kỹ thuật mới nhất",
      "about.metric_quality_label": "Cam kết chất lượng",
      "about.metric_quality_desc": "Tự tin làm hài lòng khách hàng",

      "about.services_title": "Dịch vụ chi tiết",
      "about.services_subtitle": "Khám phá các dịch vụ in ấn chuyên nghiệp",

      // services cards
      "about.service_doc_title": "In tài liệu",
      "about.service_doc_desc":
        "Báo cáo, tài liệu học tập, luận văn với chất lượng cao",
      "about.service_doc_bullet1": "In đẹp, rõ nét, có màu",
      "about.service_doc_bullet2": "Đa dạng lựa chọn giấy",
      "about.service_doc_bullet3": "Thành phẩm đóng quyển chuyên nghiệp",

      "about.service_photo_title": "In ảnh",
      "about.service_photo_desc":
        "Ảnh kỷ niệm, ảnh trang trí, ảnh nghệ thuật với màu sắc sống động",
      "about.service_photo_bullet1": "Nhiều kích thước ảnh",
      "about.service_photo_bullet2": "Chỉnh màu, tối ưu chất lượng",
      "about.service_photo_bullet3": "Khung ảnh ấn tượng",

      "about.service_card_title": "In danh thiếp",
      "about.service_card_desc":
        "Thiết kế độc đáo, in ấn chuyên nghiệp theo yêu cầu",
      "about.service_card_bullet1": "Nhiều chất liệu giấy",
      "about.service_card_bullet2": "Hỗ trợ tư vấn & thiết kế",
      "about.service_card_bullet3": "Chất lượng in sắc nét",

      "about.service_cup_title": "In ly / cốc",
      "about.service_cup_desc":
        "In logo và thiết kế riêng trên ly giấy, ly nhựa",
      "about.service_cup_bullet1": "Đa dạng kích thước ly",
      "about.service_cup_bullet2": "Màu sắc sắc nét, bền màu",
      "about.service_cup_bullet3": "Hỗ trợ in số lượng tối thiểu",

      "about.contact_title": "Thông tin liên hệ",
      "about.contact_subtitle": "Hãy ghé cửa hàng hoặc liên hệ với chúng tôi",
      "about.contact_block_title": "Địa chỉ & liên hệ",
      "about.contact_store_label": "Địa chỉ cửa hàng",
      "about.contact_store_value": "123 Nguyễn Văn Linh, Đà Nẵng, Việt Nam",
      "about.contact_hotline_label": "Hotline",
      "about.contact_hotline_value": "0236 3888 888",
      "about.contact_email_label": "Email",
      "about.contact_email_value": "info@printnow.com",
      "about.contact_working_label": "Giờ làm việc",
      "about.contact_working_monfri": "Thứ 2 - Thứ 6: 08:00 - 18:00",
      "about.contact_working_sat": "Thứ 7: 09:00 - 14:00",
      "about.contact_working_sun": "Chủ nhật: Nghỉ",

      "about.location_map": "Vị trí bản đồ",

      "about.map_title_inner": "Google Maps",
      "about.map_subtitle_inner": "[Tích hợp Maps API]",

      "about.testimonials_title": "Khách hàng nói gì?",
      "about.testimonials_subtitle": "Đánh giá chân thực từ khách hàng",
      "about.testimonial_1":
        '"Dịch vụ rất tốt, chất lượng in rõ nét. Rất phù hợp cho các nhu cầu in ấn doanh nghiệp."',
      "about.testimonial_2":
        '"Mình đến in ảnh, màu sắc và chất lượng ảnh làm mình rất hài lòng."',
      "about.testimonial_3":
        '"Giao hàng nhanh, nhân viên hỗ trợ nhiệt tình. Mình sẽ tiếp tục sử dụng dịch vụ tại đây."',

      "about.cta_title": "Sẵn sàng trải nghiệm dịch vụ?",
      "about.cta_subtitle":
        "Hãy để chúng tôi giúp bạn hiện thực hóa ý tưởng in ấn với chất lượng tốt nhất và dịch vụ chuyên nghiệp.",
      "about.cta_order": "Đặt ngay",
      "about.cta_inquire": "Liên hệ ngay",

      // ===== Home page =====
      "home.hero_title": "Dịch vụ in ấn chuyên nghiệp",
      "home.hero_subtitle":
        "Từ tài liệu văn phòng đến in ảnh, danh thiếp và ly nước – chúng tôi cung cấp giải pháp in ấn toàn diện với chất lượng cao và giá cả cạnh tranh.",
      "home.hero_order": "Đặt ngay",
      "home.hero_learn_more": "Tìm hiểu thêm",

      "home.services_title": "Dịch vụ in ấn chuyên nghiệp",
      "home.services_subtitle":
        "Khám phá các dịch vụ in ấn đa dạng, từ cơ bản đến nâng cao, đáp ứng mọi nhu cầu của bạn.",

      "home.service_doc_title": "In tài liệu",
      "home.service_doc_desc":
        "In tài liệu văn phòng, luận văn, báo cáo với chất lượng cao",
      "home.service_doc_tag1": "In trắng đen & in màu",
      "home.service_doc_tag2": "Hỗ trợ in 2 mặt",
      "home.service_doc_tag3": "Nhiều khổ giấy khác nhau",
      "home.service_doc_price": "Từ 2.000đ/trang",

      "home.service_photo_title": "In ảnh",
      "home.service_photo_desc":
        "In ảnh chất lượng cao với nhiều kích thước và bề mặt giấy",
      "home.service_photo_tag1": "Đa dạng kích thước",
      "home.service_photo_tag2": "Giấy cao cấp",
      "home.service_photo_tag3": "Màu sắc sống động",
      "home.service_photo_price": "Từ 5.000đ/tấm",

      "home.service_card_title": "In danh thiếp",
      "home.service_card_desc":
        "In danh thiếp chuyên nghiệp theo thiết kế của bạn",
      "home.service_card_tag1": "Giấy chất lượng cao",
      "home.service_card_tag2": "Thành phẩm đẹp, sang trọng",
      "home.service_card_tag3": "Số lượng linh hoạt",
      "home.service_card_price": "Từ 100.000đ/hộp",

      "home.service_cup_title": "In ly / cốc",
      "home.service_cup_desc":
        "In logo và thiết kế riêng trên ly giấy, ly nhựa",
      "home.service_cup_tag1": "Ly giấy & ly nhựa",
      "home.service_cup_tag2": "Thành phẩm đẹp mắt",
      "home.service_cup_tag3": "Giá thành hợp lý",
      "home.service_cup_price": "Từ 2.000đ/ly",

      "home.view_all_services": "Xem tất cả dịch vụ",

      "home.why_title": "Vì sao chọn chúng tôi?",
      "home.why_subtitle":
        "Với nhiều năm kinh nghiệm và công nghệ hiện đại, chúng tôi cam kết mang đến dịch vụ tốt nhất.",
      "home.why_fast_title": "Nhanh chóng",
      "home.why_fast_desc": "Thời gian in nhanh, giao đúng hẹn",
      "home.why_quality_title": "Chất lượng",
      "home.why_quality_desc": "Sử dụng máy móc hiện đại, đảm bảo chất lượng",
      "home.why_cred_title": "Uy tín",
      "home.why_cred_desc": "Nhiều năm kinh nghiệm trong ngành in ấn",
      "home.why_support_title": "Hỗ trợ 24/7",
      "home.why_support_desc": "Đội ngũ tư vấn chuyên nghiệp, hỗ trợ mọi lúc",

      "home.cta_title": "Sẵn sàng bắt đầu?",
      "home.cta_subtitle":
        "Hãy để chúng tôi giúp bạn in ra những sản phẩm chất lượng với dịch vụ tận tâm.",
      "home.cta_order": "Đặt ngay",

      "home.footer_hours_title": "Giờ làm việc",
      "home.footer_hours_line1": "Thứ 2 - Thứ 6: 8:00 - 18:00",
      "home.footer_hours_line2": "Thứ 7: 8:00 - 16:00",
      "home.footer_hours_line3": "Chủ nhật: 9:00 - 15:00",

      "home.footer_services_title": "Dịch vụ",
      "home.footer_services_line1": "In danh thiếp",
      "home.footer_services_line2": "In tài liệu",
      "home.footer_services_line3": "In ảnh",
      "home.footer_services_line4": "In bao bì",

      "home.footer_copyright": "© 2025 Bản quyền đã được bảo lưu.",

      // ===== Service Print page =====
      "service.print_title": "Dịch vụ in ấn",
      "service.print_subtitle": "Hãy chọn dịch vụ phù hợp với nhu cầu của bạn",

      "service.doc_title": "In tài liệu",
      "service.doc_desc": "In file PDF, Word, PowerPoint với nhiều tuỳ chọn",
      "service.doc_feature1": "Trắng đen & màu",
      "service.doc_feature2": "Đóng bìa luận văn",
      "service.doc_feature3": "Nhiều khổ giấy",
      "service.doc_feature4": "In 2 mặt",
      "service.doc_price": "500 VNĐ/trang",

      "service.photo_title": "In ảnh",
      "service.photo_desc":
        "In ảnh chất lượng cao với nhiều kích thước khác nhau",
      "service.photo_feature1": "Nhiều kích thước",
      "service.photo_feature2": "Chất lượng cao",
      "service.photo_feature3": "Giấy bóng/mờ",
      "service.photo_feature4": "Chỉnh màu",
      "service.photo_price": "5.000 VNĐ/tấm",

      "service.card_title": "In danh thiếp",
      "service.card_desc": "In danh thiếp chuyên nghiệp theo thiết kế của bạn",
      "service.card_feature1": "Theo thiết kế của bạn",
      "service.card_feature2": "In nhanh",
      "service.card_feature3": "Nhiều loại giấy",
      "service.card_feature4": "Chất lượng cao",
      "service.card_price": "200.000 VNĐ/hộp",

      "service.cup_title": "In ly / cốc",
      "service.cup_desc": "In logo và thiết kế trên ly giấy, ly nhựa",
      "service.cup_feature1": "Ly giấy & ly nhựa",
      "service.cup_feature2": "Số lượng lớn",
      "service.cup_feature3": "In logo/thiết kế",
      "service.cup_feature4": "Dùng cho doanh nghiệp",
      "service.cup_price": "2.000 VNĐ/ly",

      "service.price_from": "Giá từ",
      "service.select_btn": "Chọn dịch vụ",

      "service.help_title": "Cần hỗ trợ?",
      "service.help_subtitle":
        "Liên hệ với chúng tôi để được tư vấn chi tiết về dịch vụ.",
      "service.contact_hotline": "Hotline: 1900169874",
      "service.contact_email": "Email: print@gmail.com",

      "service.footer_desc": "Dịch vụ in ấn nhanh chóng & đáng tin cậy.",
      "service.footer_copyright": "© 2025 PrintNow",

      // ===== Notification page =====
      "notif.bell_title": "Thông báo",
      "notif.back_title": "Quay lại",
      "notif.title": "Thông báo",
      "notif.subtitle":
        "Theo dõi trạng thái đơn hàng và các thông báo quan trọng",

      "notif.btn_mark_all": "Đánh dấu tất cả đã đọc",
      "notif.btn_delete_read": "Xoá thông báo đã đọc",
      "notif.btn_mark_read": "Đánh dấu đã đọc",
      "notif.btn_delete": "Xoá",

      "notif.unread_suffix": "chưa đọc",
      "notif.tag_important": "Quan trọng",
      "notif.load_error": "Không thể tải danh sách thông báo.",
      "notif.empty": "Chưa có thông báo nào.",

      "notif.time_just_now": "vừa xong",
      "notif.time_minutes_ago": "{n} phút trước",
      "notif.time_hours_ago": "{n} giờ trước",
      "notif.time_days_ago": "{n} ngày trước",

      // ===== Order details page =====
      "order.title": "Chi tiết đơn hàng",
      "order.subtitle": "Xem đầy đủ thông tin đơn hàng của bạn.",
      "order.box_order_info": "Thông tin đơn hàng",
      "order.box_customer": "Khách hàng",
      "order.field_order_id": "Mã đơn",
      "order.field_date": "Ngày tạo",
      "order.field_status": "Trạng thái",
      "order.field_reason": "Lý do",
      "order.field_name": "Họ tên",
      "order.field_email": "Email",
      "order.table_product": "Sản phẩm",
      "order.table_quantity": "Số lượng",
      "order.table_unit_price": "Đơn giá",
      "order.table_total": "Thành tiền",
      "order.table_note": "Ghi chú",
      "order.table_file_upload": "File đã tải",
      "order.summary_subtotal": "Tạm tính",
      "order.summary_adjustment": "Điều chỉnh",
      "order.summary_total": "Tổng cộng",
      "order.btn_reorder": "Đặt lại",
      "order.btn_cancel": "Hủy đơn",
      "order.btn_return": "Quay lại",
      "order.status_completed": "Hoàn thành",
      "order.status_processing": "Đang xử lý",
      "order.status_cancelled": "Đã hủy",
      "order.status_pending": "Chờ xử lý",
      "orders.status_cancelled": "Đã hủy",
      "order.cancel_confirm": "Bạn chắc chắn muốn hủy đơn này?",
      "order.cancel_reason_placeholder": "Lý do hủy (tuỳ chọn):",
      "order.cancel_failed": "Không thể hủy đơn. Vui lòng thử lại.",
      "order.cancel_success": "Đã hủy đơn.",

      // ===== Order history page =====
      "order_history.title": "Lịch sử đơn hàng",
      "order_history.subtitle":
        "Xem lại các đơn hàng đã đặt và trạng thái dễ dàng.",
      "order_history.filter_all": "Tất cả",
      "order_history.filter_pending": "Chờ xử lý",
      "order_history.filter_completed": "Hoàn thành",
      "order_history.filter_processing": "Đang xử lý",
      "order_history.filter_cancelled": "Đã hủy",
      "order_history.caption":
        "Lịch sử đơn hàng của bạn với trạng thái và tổng tiền",
      "order_history.th_order_id": "Mã đơn",
      "order_history.th_date": "Ngày",
      "order_history.th_status": "Trạng thái",
      "order_history.th_total": "Tổng tiền",
      "order_history.th_action": "Thao tác",
      "order_history.btn_view": "Xem",
      "order_history.btn_reorder": "Đặt lại",
      "order_history.btn_cancel": "Hủy đơn",
      "order_history.reorder_not_allowed_cancelled":
        "Không thể đặt lại đơn đã bị hủy.",
      "order_history.reorder_login_required":
        "Vui lòng đăng nhập lại để đặt lại đơn.",
      "order_history.reorder_no_items":
        "Không tìm thấy sản phẩm trong đơn để đặt lại.",
      "order_history.reorder_failed": "Không thể đặt lại. Vui lòng thử lại.",

      // ===== Order payment page =====
      "order_payment.page_title": "Thanh toán đơn hàng",
      "order_payment.loading": "Đang tải chi tiết đơn hàng...",
      "order_payment.title": "Thanh toán đơn hàng",
      "order_payment.subtitle": "Chọn phương thức thanh toán phù hợp",
      "order_payment.section_info_title": "Thông tin thanh toán",
      "order_payment.label_order_code": "Mã đơn hàng:",
      "order_payment.label_quantity": "Số lượng:",
      "order_payment.label_total": "Tổng giá trị đơn hàng:",
      "order_payment.deposit_title": "Yêu cầu đặt cọc 50%",
      "order_payment.deposit_desc":
        "Đơn hàng trên 100.000 VND cần thanh toán trước 50%.",
      "order_payment.deposit_pay_now_label": "Số tiền cần thanh toán ngay:",
      "order_payment.deposit_cod_label": "Thanh toán khi nhận hàng:",
      "order_payment.section_method_title": "Phương thức thanh toán",
      "order_payment.method_store_title": "Thanh toán tại cửa hàng",
      "order_payment.method_store_desc":
        "Thanh toán trực tiếp khi đến nhận hàng",
      "order_payment.method_vnpay_title": "Thanh toán online qua VnPay",
      "order_payment.method_vnpay_desc": "Thanh toán toàn bộ số tiền online",
      "order_payment.method_recommended": "Khuyến nghị",
      "order_payment.section_qr_title": "Thanh toán bằng QR Code",
      "order_payment.qr_waiting": "Đang chờ thanh toán...",
      "order_payment.qr_helper":
        "Sử dụng các ứng dụng ngân hàng hoặc ví điện tử hỗ trợ VnPay",
      "order_payment.summary_title": "Tóm tắt đơn hàng",
      "order_payment.summary_total_label": "Tổng tiền:",
      "order_payment.summary_pay_now_label": "Thanh toán ngay:",
      "order_payment.btn_confirm_store": "Xác nhận thanh toán tại cửa hàng",
      "order_payment.btn_confirm_vnpay": "Tôi đã thanh toán qua VnPay",
      "order_payment.benefit_time": "Thời gian hoàn thành: 2-5 ngày làm việc",
      "order_payment.benefit_email":
        "Gửi email thông báo khi hoàn tất đơn hàng",

      // ===== Order status page =====
      "order_status.page_title": "Trạng thái đơn hàng",
      "order_status.title": "Trạng thái đơn hàng",
      "order_status.subtitle": "Theo dõi tiến trình xử lý đơn hàng của bạn",
      "order_status.progress_label": "Tiến trình đơn hàng",
      "order_status.summary_title": "Tóm tắt đơn hàng",
      "order_status.summary_total": "Tổng tiền:",
      "order_status.summary_paid": "Đã thanh toán:",
      "order_status.summary_remaining": "Số tiền còn lại:",
      "order_status.summary_order_code": "Mã đơn hàng",
      "order_status.details_title": "Chi tiết đơn hàng",
      "order_status.field_order_code": "Mã đơn hàng",
      "order_status.field_order_date": "Ngày tạo đơn",
      "order_status.field_service": "Dịch vụ",
      "order_status.field_expected": "Thời gian hoàn thành dự kiến",
      "order_status.field_quantity": "Số lượng",
      "order_status.field_payment_method": "Phương thức thanh toán",
      "order_status.step1_title": "Đã tiếp nhận đơn",
      "order_status.step1_desc": "Đơn hàng đã được tiếp nhận và xác nhận.",
      "order_status.step2_title": "Đang xử lý",
      "order_status.step2_desc": "Đang chuẩn bị file và kiểm tra chất lượng.",
      "order_status.step3_title": "Đang in",
      "order_status.step3_desc":
        "Đơn hàng đang được tiến hành in theo yêu cầu.",
      "order_status.step4_title": "Kiểm tra chất lượng",
      "order_status.step4_desc": "Kiểm tra chất lượng sản phẩm trước khi giao.",
      "order_status.step5_title": "Sẵn sàng giao/nhận",
      "order_status.step5_desc": "Sản phẩm đã hoàn tất, sẵn sàng giao/nhận.",
      "order_status.step6_title": "Hoàn thành",
      "order_status.step6_desc": "Đơn hàng đã hoàn tất thành công.",
      "order_status.alert_not_found":
        "Không tìm thấy dữ liệu đơn hàng! Vui lòng quay lại trang xác nhận.",

      // ===== Order confirmation page =====
      "order_confirm.page_title": "Xác nhận đơn hàng | PrintNow",
      "order_confirm.title": "Xác nhận đơn hàng",
      "order_confirm.subtitle":
        "Kiểm tra lại thông tin đơn hàng trước khi thanh toán",
      "order_confirm.service_title_doc": "In tài liệu",
      "order_confirm.service_title_photo": "In ảnh",
      "order_confirm.customer_info_title": "Thông tin khách hàng",
      "order_confirm.file_list_title_doc": "Danh sách tài liệu cần in",
      "order_confirm.file_list_title_photo": "Danh sách ảnh cần in",
      "order_confirm.label_order_code": "Mã đơn hàng:",
      "order_confirm.file_detail_page": "trang",
      "order_confirm.file_detail_pages": "trang",
      "order_confirm.file_detail_copy": "bản in",
      "order_confirm.file_detail_copies": "bản in",
      "order_confirm.file_detail_photo": "ảnh",
      "order_confirm.file_detail_photos": "ảnh",
      "order_confirm.file_detail_side_single": "Một mặt",
      "order_confirm.file_detail_side_double": "Hai mặt",
      "order_confirm.file_detail_borderless": "Không viền",
      "order_confirm.file_detail_bound": "Đóng bìa",
      "order_confirm.file_detail_cover": "Trang bìa",
      "order_confirm.file_detail_mode_bw": "Trắng đen",
      "order_confirm.file_detail_mode_color": "In màu",
      "order_confirm.special_requests_title": "Yêu cầu đặc biệt",
      "order_confirm.summary_title": "Tóm tắt đơn hàng",
      "order_confirm.summary_count_label": "Số lượng tài liệu:",
      "order_confirm.summary_total_label": "Tổng tiền:",
      "order_confirm.btn_proceed_payment": "Tiến hành thanh toán",
      "order_confirm.count_docs_singular": "tài liệu",
      "order_confirm.count_docs_plural": "tài liệu",
      "order_confirm.count_photos_singular": "ảnh",
      "order_confirm.count_photos_plural": "ảnh",

      // ===== Personal profile page =====
      "profile.page_title": "Hồ sơ cá nhân | PrintNow",
      "profile.title": "Hồ sơ cá nhân",
      "profile.subtitle": "Quản lý thông tin tài khoản của bạn",

      "profile.role_customer": "Khách hàng",
      "profile.joined_prefix": "Tham gia:",

      "profile.btn_edit": "Chỉnh sửa",
      "profile.btn_save": "Lưu",

      "profile.section_info_title": "Thông tin cá nhân",
      "profile.section_info_desc": "Cập nhật thông tin liên hệ của bạn",

      "profile.field_full_name": "Họ và tên",
      "profile.field_email": "Email",
      "profile.field_phone": "Số điện thoại",
      "profile.field_address": "Địa chỉ",

      "profile.btn_edit": "Chỉnh sửa",

      "profile.activity_title": "Thống kê hoạt động",
      "profile.stat_total": "Tổng số đơn",
      "profile.stat_completed": "Hoàn thành",
      "profile.stat_inprogress": "Đang xử lý",
      "profile.stat_cancelled": "Đã hủy",

      "profile.avatar_title": "Ảnh đại diện",
      "profile.avatar_helper":
        "Chọn ảnh mới để cập nhật (PNG/JPG/GIF/WEBP ≤ 5MB)",
      "profile.avatar_btn_cancel": "Hủy",
      "profile.avatar_btn_upload": "Tải lên",

      // extra benefit for confirmation page
      "order_payment.benefit_payment_support":
        "Hỗ trợ thanh toán tại cửa hàng và online",

      // ===== Print photo page =====
      "print_photo.page_title": "In ảnh",
      "print_photo.title": "In ảnh chất lượng cao",
      "print_photo.subtitle":
        "Tải ảnh của bạn lên và chọn kích thước, loại giấy",
      "print_photo.customer_info_title": "Thông tin khách hàng",
      "print_photo.upload_section_title": "Tải ảnh lên",
      "print_photo.upload_main": "Chọn ảnh cần in",
      "print_photo.upload_helper":
        "Hỗ trợ JPG, PNG, TIFF (tối đa 20MB mỗi ảnh, tối thiểu 300 DPI)",
      "print_photo.upload_button": "Chọn file",
      "print_photo.special_request_title": "Yêu cầu đặc biệt",
      "print_photo.special_request_label": "Ghi chú thêm (tuỳ chọn)",
      "print_photo.special_request_placeholder":
        "Ví dụ: cắt theo khung, chỉnh màu, giao tới địa chỉ khác...",
      "print_photo.config_section_title": "Cấu hình in ảnh",
      "print_photo.label_paper_type": "Loại giấy",
      "print_photo.borderless_label": "Không viền (10%)",
      "print_photo.footer_note_borderless":
        "Ảnh sẽ được in full, không chừa viền trắng xung quanh.",
      "print_photo.summary_title": "Tóm tắt đơn hàng",
      "print_photo.summary_empty": "Chưa tải lên ảnh nào",
      "print_photo.summary_count_label": "Số lượng ảnh:",
      "print_photo.summary_total_label": "Tổng tiền:",
      "print_photo.btn_proceed_payment": "Tiếp tục thanh toán",
      "print_photo.btn_creating_order": "Đang tạo đơn...",
      "print_photo.count_photos_singular": "ảnh",
      "print_photo.count_photos_plural": "ảnh",

      // ===== Print document page =====
      "print_doc.page_title": "In tài liệu",
      "print_doc.title": "In tài liệu",
      "print_doc.subtitle":
        "Tải file lên và cấu hình tuỳ chọn in cho từng file",
      "print_doc.customer_info_title": "Thông tin khách hàng",
      "print_doc.field_full_name_label": "Họ và tên",
      "print_doc.field_full_name_placeholder": "Nhập họ và tên",
      "print_doc.field_email_label": "Email",
      "print_doc.field_email_placeholder": "Nhập email",
      "print_doc.upload_section_title": "Tải file lên",
      "print_doc.upload_main": "Chọn file cần in",
      "print_doc.upload_helper":
        "Hỗ trợ PDF, DOC, DOCX, PPT, PPTX (tối đa 10MB mỗi file)",
      "print_doc.special_request_title": "Yêu cầu đặc biệt",
      "print_doc.special_request_placeholder":
        "Ví dụ: cần trước 14h, in trên giấy dày hơn...",
      "print_doc.config_section_title": "Cấu hình file in",
      "print_doc.label_copies": "Số lượng bản in",
      "print_doc.label_paper_size": "Khổ giấy",
      "print_doc.label_printed_sides": "Kiểu in (1 mặt/2 mặt)",
      "print_doc.label_print_mode": "Chế độ in",
      "print_doc.print_mode_bw": "Trắng đen",
      "print_doc.print_mode_color": "In màu",
      "print_doc.print_mode_combination": "Kết hợp (một số trang in màu)",
      "print_doc.label_color_pages": "Các trang cần in màu",
      "print_doc.placeholder_color_pages": "VD: 1, 3-5, 8, 10",
      "print_doc.label_document_type": "Loại tài liệu",
      "print_doc.doc_type_regular": "Thông thường",
      "print_doc.doc_type_thesis": "Luận văn/Báo cáo",
      "print_doc.binding_label": "Đóng bìa (5.000₫)",
      "print_doc.cover_label": "Trang bìa (2.000₫)",
      "print_doc.summary_title": "Tóm tắt đơn hàng",
      "print_doc.summary_empty": "Chưa có file nào được tải lên",
      "print_doc.summary_count_label": "Số lượng file:",
      "print_doc.summary_total_label": "Tổng tiền:",
      "print_doc.btn_proceed_payment": "Tiến hành thanh toán",
      "print_doc.files_suffix": "file",
      "print_doc.alert_missing_customer": "Vui lòng nhập Họ và tên và Email.",
      "print_doc.btn_processing": "Đang xử lý...",
      "print_doc.alert_create_order_failed":
        "Tạo đơn thất bại. Vui lòng thử lại.",

      // ===== Customers dashboard page =====
      "customers.page_title": "Khách hàng",
      "customers.breadcrumb": "Khách hàng",
      "customers.btn_add_customer": " Thêm khách hàng mới",
      "customers.summary_title": "Tổng quan khách hàng",
      "customers.period_this_week": "Tuần này",
      "customers.period_this_month": "Tháng này",
      "customers.period_this_year": "Năm nay",
      "customers.card_total_customers": "Tất cả khách hàng",
      "customers.card_active_customers": "Đang hoạt động",
      "customers.card_inactive_customers": "Ngưng hoạt động",
      "customers.card_new_customers": "Khách hàng mới",
      "customers.card_purchasing_customers": "Đang mua hàng",
      "customers.card_abandoned_carts": "Bỏ giỏ hàng",
      "customers.table_title": "Khách hàng",
      "customers.search_placeholder": "Tìm kiếm",
      "customers.filter_button": "Lọc",
      "customers.filter_title": "Bộ lọc",
      "customers.filter_status_label": "Trạng thái",
      "customers.filter_status_all": "Tất cả",
      "customers.filter_status_active": "Đang hoạt động",
      "customers.filter_status_inactive": "Ngưng hoạt động",
      "customers.filter_customer_label": "Khách hàng",
      "customers.filter_customer_all": "Tất cả",
      "customers.filter_amount_label": "Số tiền",
      "customers.filter_amount_from": "Từ",
      "customers.filter_amount_to": "Đến",
      "customers.filter_amount_placeholder": "0.00",
      "customers.filter_apply_button": "Lọc",
      "customers.date_filter_title": "Theo ngày",
      "customers.date_filter_this_week": "Tuần này",
      "customers.date_filter_last_week": "Tuần trước",
      "customers.date_filter_this_month": "Tháng này",
      "customers.date_filter_last_month": "Tháng trước",
      "customers.date_filter_this_year": "Năm nay",
      "customers.date_filter_last_year": "Năm trước",
      "customers.date_filter_custom": "Khoảng ngày tuỳ chọn",
      "customers.date_from_btn": "Từ ngày",
      "customers.date_to_btn": "Đến ngày",
      "customers.status_active": "Đang hoạt động",
      "customers.status_inactive": "Ngưng hoạt động",
      "customers.bulk_status_all": "Cập nhật trạng thái",
      "customers.bulk_status_active": "Đang hoạt động",
      "customers.bulk_status_inactive": "Ngưng hoạt động",
      "customers.th_id": "Mã khách",
      "customers.th_name": "Tên khách hàng",
      "customers.th_email": "Email",
      "customers.th_phone": "Số điện thoại",
      "customers.th_orders": "Số đơn",
      "customers.th_total": "Tổng đơn hàng",
      "customers.th_since": "Khách từ ngày",
      "customers.th_status": "Trạng thái",
      "customers.pagination_per_page": "10 mục mỗi trang",
      "customers.pagination_items": "1-10 trên 200 mục",
      "customers.pagination_pages": "Trang 1 trên 44",

      // ===== Orders Dashboard (Employee) =====
      "orders.page_title": "Bảng điều khiển đơn hàng",
      "orders.breadcrumb": "Đơn hàng",
      "orders.btn_create_order": " Tạo đơn hàng mới",
      "orders.summary_title": "Tổng quan đơn hàng",
      "orders.card_all_orders": "Tất cả đơn",
      "orders.card_pending": "Chờ xử lý",
      "orders.card_completed": "Hoàn thành",
      "orders.card_canceled": "Đã hủy",
      "orders.card_returned": "Trả hàng",
      "orders.card_damaged": "Hư hỏng",
      "orders.card_abandoned_cart": "Bỏ giỏ hàng",
      "orders.card_customers": "Khách hàng",
      "orders.table_title": "Đơn hàng của khách",
      "orders.filter_order_type": "Loại đơn hàng",
      "orders.order_type_document": "In tài liệu",
      "orders.order_type_photo": "In ảnh",
      "orders.order_type_card": "In danh thiếp",
      "orders.order_type_cup": "In ly/cốc",
      "orders.bulk_action": "Thao tác hàng loạt",
      "orders.th_order_type": "Loại đơn hàng",
      "orders.status_pending": "Chờ xử lý",
      "orders.status_in_progress": "Đang xử lý",
      "orders.status_ready": "Sẵn sàng",
      "orders.status_completed": "Hoàn thành",
      "orders.status_canceled": "Đã hủy",
      "orders.status_cancelled": "Đã hủy",

      // ===== Chi tiết khách hàng (Nhân viên) =====
      "customer_details.page_title": "Chi tiết khách hàng",
      "customer_details.breadcrumb_view": "Xem khách hàng",
      "customer_details.customer_id_label": "Mã khách hàng",
      "customer_details.customer_since": "Khách từ",
      "customer_details.copied": "Đã sao chép!",
      "customer_details.btn_delete": "Xóa khách hàng",
      "customer_details.card_basic_last_order": "Đơn hàng gần nhất",
      "customer_details.card_basic_phone": "Số điện thoại",
      "customer_details.card_basic_email": "Email",
      "customer_details.card_basic_no_orders": "Chưa có đơn hàng",
      "customer_details.card_basic_status_active": "Đang hoạt động",
      "customer_details.card_basic_status_inactive": "Ngưng hoạt động",
      "customer_details.card_address_title": "Địa chỉ",
      "customer_details.card_address_empty": "Chưa có địa chỉ",
      "customer_details.card_total_title": "Tổng chi tiêu",
      "customer_details.card_total_filter_all": "Tất cả thời gian",
      "customer_details.card_total_filter_month": "Tháng này",
      "customer_details.section_orders_title": "Đơn hàng của {name}",
      "customer_details.search_placeholder": "Tìm kiếm",
      "customer_details.filter_general_button": "Lọc",
      "customer_details.filter_general_title": "Tùy chọn lọc",
      "customer_details.filter_status_label": "Trạng thái",
      "customer_details.filter_status_all": "Tất cả",
      "customer_details.filter_status_pending": "Chờ xử lý",
      "customer_details.filter_status_in_progress": "Đang xử lý",
      "customer_details.filter_status_ready": "Sẵn sàng",
      "customer_details.filter_status_completed": "Hoàn thành",
      "customer_details.filter_status_cancelled": "Đã hủy",
      "customer_details.filter_payment_label": "Phương thức thanh toán",
      "customer_details.filter_payment_all": "Tất cả",
      "customer_details.filter_payment_online": "Thanh toán online",
      "customer_details.filter_payment_cod": "Thanh toán khi nhận hàng",
      "customer_details.filter_payment_direct": "Thanh toán trực tiếp",
      "customer_details.filter_apply": "Áp dụng",
      "customer_details.filter_date_button": "Lọc",
      "customer_details.filter_date_title": "Lọc theo ngày",
      "customer_details.filter_date_today": "Hôm nay",
      "customer_details.filter_date_this_week": "Tuần này",
      "customer_details.filter_date_this_month": "Tháng này",
      "customer_details.filter_date_last_month": "Tháng trước",
      "customer_details.filter_date_this_year": "Năm nay",
      "customer_details.filter_date_custom": "Khoảng ngày tùy chọn",
      "customer_details.share_button": "Chia sẻ",
      "customer_details.bulk_action_label": "Thao tác nhanh",
      "customer_details.bulk_action_pending": "Chờ xử lý",
      "customer_details.bulk_action_in_progress": "Đang xử lý",
      "customer_details.bulk_action_ready": "Sẵn sàng",
      "customer_details.bulk_action_completed": "Hoàn thành",
      "customer_details.bulk_action_cancelled": "Đã hủy",
      "customer_details.th_order_date": "Ngày đặt",
      "customer_details.th_payment_method": "Hình thức thanh toán",
      "customer_details.th_order_total": "Tổng đơn",
      "customer_details.th_status": "Trạng thái",
      "customer_details.empty_message":
        "Không có đơn hàng nào phù hợp với bộ lọc.",
      "customer_details.error_missing_id":
        "Không tìm thấy ID khách hàng. Vui lòng truy cập từ trang danh sách khách hàng.",
      "customer_details.error_load_failed":
        "Không thể tải chi tiết khách hàng.",
      "customer_details.error_delete_failed": "Không thể xóa khách hàng.",
      "customer_details.error_generic": "Có lỗi xảy ra khi tải dữ liệu.",
      "customer_details.confirm_delete":
        "Bạn chắc chắn muốn xóa khách hàng này?",
      "customer_details.delete_success": "Xóa khách hàng thành công!",

      // ===== Orders Dashboard – Create Order Modal =====
      "orders.create_title": "Tạo đơn hàng mới",
      "orders.form_select_customer": "Chọn khách hàng",
      "orders.form_customer_placeholder":
        "Nhập tên hoặc số điện thoại khách hàng...",
      "orders.form_payment_type": "Hình thức thanh toán",
      "orders.payment_in_store": "Thanh toán tại quầy",
      "orders.payment_online": "Thanh toán online",
      "orders.form_order_type": "Loại đơn hàng",
      "orders.form_choose_type": "Chọn loại",
      "orders.form_order_status": "Trạng thái đơn",
      "orders.form_order_datetime": "Thời gian & ngày đặt",
      "orders.form_pages_estimated": "Số trang (ước tính)",
      "orders.form_pages_placeholder": "VD: 10",
      "orders.form_copies": "Số bản in",
      "orders.form_copies_placeholder": "VD: 2",
      "orders.form_unit_price": "Đơn giá (₫)",
      "orders.form_order_note": "Ghi chú đơn hàng",
      "orders.form_order_note_placeholder": "Thêm ghi chú (không bắt buộc)...",
      "orders.btn_create_order_submit": "Tạo đơn hàng",
      "orders.tooltip_cancelled_order": "Đơn đã bị hủy",

      // ===== ADD into DICT.vi =====
      // --- Auth / Owner Dashboard guards ---
      "auth.confirm_logout": "Bạn chắc chắn muốn đăng xuất?",
      "auth.login_required": "Vui lòng đăng nhập để xem bảng điều khiển.",
      "auth.session_expired": "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.",

      // --- Owner Dashboard (optional but recommended) ---
      "dashboard.title": "Bảng điều khiển",

      "dashboard.nav.dashboard": "Bảng điều khiển",
      "dashboard.nav.orders": "Đơn hàng",
      "dashboard.nav.customers": "Khách hàng",
      "dashboard.nav.inventory": "Kho hàng",
      "dashboard.nav.settings": "Cài đặt",
      "dashboard.nav.contact_support": "Hỗ trợ",
      "dashboard.nav.logout": "Đăng xuất",

      "dashboard.kpi.sales": "Doanh thu",
      "dashboard.kpi.volume": "Số đơn",
      "dashboard.kpi.customers": "Khách hàng",
      "dashboard.kpi.active": "Đang hoạt động",

      "dashboard.marketing.title": "Marketing",
      "dashboard.marketing.acquisition": "Tiếp cận",
      "dashboard.marketing.purchase": "Mua hàng",
      "dashboard.marketing.retention": "Giữ chân",
      "dashboard.marketing.center_customers": "Khách hàng",

      "dashboard.products.all_products": "Tất cả sản phẩm",
      "dashboard.products.active": "Đang kinh doanh",

      "dashboard.cart.abandoned_cart": "Bỏ giỏ hàng",
      "dashboard.cart.customers": "Khách hàng",

      "dashboard.summary.title": "Tổng quan",
      "dashboard.summary.sales": "Doanh thu",

      "dashboard.recent_orders.title": "Đơn hàng gần đây",
      "dashboard.recent_orders.product": "Sản phẩm",
      "dashboard.recent_orders.unit_price": "Đơn giá",
      "dashboard.recent_orders.qty": "SL",
      "dashboard.recent_orders.discount": "Giảm giá",
      "dashboard.recent_orders.total": "Tổng tiền",

      "dashboard.time.today": "Hôm nay",
      "dashboard.time.this_week": "Tuần này",
      "dashboard.time.this_month": "Tháng này",
      "dashboard.time.last_7_days": "7 ngày gần đây",
      "dashboard.time.last_30_days": "30 ngày gần đây",

      // used in your JS for empty table
      "dashboard.no_recent_orders": "Chưa có đơn hàng gần đây."

    },
  };

  function getLang() {
    return localStorage.getItem(KEY) || "en";
  }
  function setLang(lang) {
    const v = ["en", "vi"].includes(lang) ? lang : "en";
    localStorage.setItem(KEY, v);
    document.documentElement.setAttribute("lang", v);
    translateDom();
    // phát tín hiệu cho các tab/JS khác nếu cần
    window.dispatchEvent(
      new CustomEvent("lang-changed", { detail: { lang: v } })
    );
  }
  function t(key, fallback) {
    const lang = getLang();
    return (
      (DICT[lang] && DICT[lang][key]) ||
      (DICT.en && DICT.en[key]) ||
      fallback ||
      key
    );
  }

  // format with variables: i18n.f("alert.file_too_large", {name:"a.pdf", max:10})
  function f(key, vars = {}) {
    const str = t(key);
    return String(str).replace(/\{(\w+)\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : `{${k}}`
    );
  }
  function translateDom(root = document) {
    // text nodes
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    // placeholders
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute(
        "placeholder",
        t(el.getAttribute("data-i18n-placeholder"))
      );
    });
    // titles (optional)
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    // aria-label (a11y)
    root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
    });
  }

  // expose
  window.i18n = { getLang, setLang, t, f, translateDom };

  // auto apply on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.setAttribute("lang", getLang());
    translateDom();
  });
})();
