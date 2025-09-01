<?php
/**
 * Plugin Name: QR Access for LearnDash
 * Description: QR → Login/Reg → LearnDash auto-enroll → Redirect a teszt oldalra. Token TTL, aláírás, marketing consent és UTM mentés.
 * Version: 1.0.0
 * Author: Custom
 */

if (!defined('ABSPATH')) exit;

class QRAccessPlugin {
	const OPTION_GROUP   = 'qr_access_options';
	const OPTION_NAME    = 'qr_access_settings';
	const COOKIE_NAME    = 'qr_access_token';
	const TRANSIENT_PREF = 'qr_access_';
	const DEFAULT_TTL    = 3600; // 1 óra

	public function __construct() {
		add_action('admin_init',               [$this, 'register_settings']);
		add_action('admin_menu',               [$this, 'register_admin_menu']);
		add_action('rest_api_init',            [$this, 'register_rest']);
		add_action('init',                     [$this, 'maybe_handle_qr_entry']);
		add_action('wp_login',                 [$this, 'maybe_enroll_after_login'], 10, 2);
		add_filter('login_redirect',           [$this, 'maybe_redirect_after_login'], 10, 3);
		add_action('register_form',            [$this, 'register_form_marketing_consent']);
		add_filter('registration_errors',      [$this, 'validate_marketing_consent'], 10, 3);
		add_action('user_register',            [$this, 'save_marketing_consent']);
	}

	// ——— Settings
	public function register_settings() {
		register_setting(self::OPTION_GROUP, self::OPTION_NAME, [
			'type' => 'array',
			'default' => [
				'course_id' => 0,
				'redirect_url' => '',
				'ttl' => self::DEFAULT_TTL,
				'require_consent' => 0,
			],
			'sanitize_callback' => function($input) {
				return [
					'course_id' => max(0, (int)($input['course_id'] ?? 0)),
					'redirect_url' => esc_url_raw($input['redirect_url'] ?? ''),
					'ttl' => max(60, (int)($input['ttl'] ?? self::DEFAULT_TTL)),
					'require_consent' => !empty($input['require_consent']) ? 1 : 0,
				];
			}
		]);

		add_settings_section('qr_main', __('Beállítások', 'qr-access'), function() {
			echo '<p>'.esc_html__('Alapértelmezett LearnDash kurzus és átirányítás a QR linkhez.', 'qr-access').'</p>';
		}, self::OPTION_NAME);

		add_settings_field('course_id', __('LearnDash kurzus ID', 'qr-access'), function() {
			$opts = get_option(self::OPTION_NAME);
			printf('<input type="number" name="%s[course_id]" value="%d" class="regular-text" min="0" />', esc_attr(self::OPTION_NAME), (int)($opts['course_id'] ?? 0));
			echo '<p class="description">'.esc_html__('A kurzus azonosítója, amire a felhasználót be kell iratni.', 'qr-access').'</p>';
		}, self::OPTION_NAME, 'qr_main');

		add_settings_field('redirect_url', __('Átirányítás (teszt oldal URL)', 'qr-access'), function() {
			$opts = get_option(self::OPTION_NAME);
			printf('<input type="url" name="%s[redirect_url]" value="%s" class="regular-text" />', esc_attr(self::OPTION_NAME), esc_attr($opts['redirect_url'] ?? ''));
			echo '<p class="description">'.esc_html__('Sikeres bejelentkezés és beiratkozás után ide irányítunk. Pl.: https://vallalatikepzesek.hu/courses/vezetoi-potencial/lessons/vezetoi-potencial-teszt/', 'qr-access').'</p>';
		}, self::OPTION_NAME, 'qr_main');

		add_settings_field('ttl', __('Token TTL (másodperc)', 'qr-access'), function() {
			$opts = get_option(self::OPTION_NAME);
			printf('<input type="number" name="%s[ttl]" value="%d" class="small-text" min="60" />', esc_attr(self::OPTION_NAME), (int)($opts['ttl'] ?? self::DEFAULT_TTL));
		}, self::OPTION_NAME, 'qr_main');

		add_settings_field('require_consent', __('Marketing hozzájárulás kötelező', 'qr-access'), function() {
			$opts = get_option(self::OPTION_NAME);
			printf('<label><input type="checkbox" name="%s[require_consent]" value="1" %s /> %s</label>',
				esc_attr(self::OPTION_NAME),
				checked(1, (int)($opts['require_consent'] ?? 0), false),
				esc_html__('Regisztrációnál kötelező checkbox', 'qr-access')
			);
		}, self::OPTION_NAME, 'qr_main');
	}

	public function register_admin_menu() {
		add_options_page(
			'QR Access',
			'QR Access',
			'manage_options',
			'qr-access',
			[$this, 'render_settings_page']
		);
		add_management_page(
			'QR Link generálás',
			'QR Link generálás',
			'manage_options',
			'qr-access-generate',
			[$this, 'render_generate_page']
		);
	}

	public function render_settings_page() {
		echo '<div class="wrap"><h1>QR Access</h1>';
		echo '<form method="post" action="options.php">';
		settings_fields(self::OPTION_GROUP);
		do_settings_sections(self::OPTION_NAME);
		submit_button();
		echo '</form></div>';
	}

	public function render_generate_page() {
		if (!current_user_can('manage_options')) return;
		$opts = get_option(self::OPTION_NAME);
		$course = isset($_POST['course_id']) ? (int)$_POST['course_id'] : (int)($opts['course_id'] ?? 0);
		$redirect = isset($_POST['redirect_url']) ? esc_url_raw($_POST['redirect_url']) : ($opts['redirect_url'] ?? '');
		$link = '';
		if (!empty($_POST['qr_generate'])
			&& isset($_POST['qr_generate_nonce'])
			&& wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['qr_generate_nonce'])), 'qr_generate_action')
			&& $course > 0 && filter_var($redirect, FILTER_VALIDATE_URL)) {
			$payload = [
				'cid' => $course,
				'redirect' => $redirect,
				'exp' => time() + max(60, (int)($opts['ttl'] ?? self::DEFAULT_TTL)),
				'nonce' => wp_generate_password(12, false),
			];
			$token = $this->sign_token($payload);
			set_transient(self::TRANSIENT_PREF.$token, $payload, max(60, (int)($opts['ttl'] ?? self::DEFAULT_TTL)));
			$link = add_query_arg(['qr' => '1', 't' => rawurlencode($token)], home_url('/'));
		}

		echo '<div class="wrap"><h1>QR Link generálás</h1>';
		echo '<form method="post">';
		wp_nonce_field('qr_generate_action', 'qr_generate_nonce');
		echo '<table class="form-table"><tr><th>KurzUS ID</th><td><input name="course_id" type="number" value="'.esc_attr($course).'" /></td></tr>';
		echo '<tr><th>Redirect URL</th><td><input name="redirect_url" type="url" class="regular-text" value="'.esc_attr($redirect).'" /></td></tr></table>';
		submit_button('Link generálása', 'primary', 'qr_generate');
		if ($link) {
			echo '<p><strong>Link:</strong> <a href="'.esc_url($link).'" target="_blank">'.esc_html($link).'</a></p>';
			echo '<p>Ebből készíts QR kódot.</p>';
		}
		echo '</form></div>';
	}

	// ——— REST: admin-only token issue
	public function register_rest() {
		register_rest_route('qr/v1', '/issue', [
			'methods'  => 'POST',
			'permission_callback' => function () { return current_user_can('manage_options'); },
			'callback' => function(WP_REST_Request $req) {
				$opts = get_option(self::OPTION_NAME);
				$courseId = (int)($req->get_param('course_id') ?: ($opts['course_id'] ?? 0));
				$redirect = esc_url_raw($req->get_param('redirect') ?: ($opts['redirect_url'] ?? ''));
				$ttl      = max(60, (int)($req->get_param('ttl') ?: ($opts['ttl'] ?? self::DEFAULT_TTL)));
				if ($courseId <= 0 || !filter_var($redirect, FILTER_VALIDATE_URL)) {
					return new WP_REST_Response(['error' => 'Invalid course_id or redirect'], 400);
				}
				$payload = ['cid'=>$courseId,'redirect'=>$redirect,'exp'=>time()+$ttl,'nonce'=>wp_generate_password(12,false)];
				$token = $this->sign_token($payload);
				set_transient(self::TRANSIENT_PREF.$token, $payload, $ttl);
				$link = add_query_arg(['qr'=>'1','t'=>rawurlencode($token)], home_url('/'));
				return ['link'=>$link,'expires'=>gmdate('c',$payload['exp']),'payload'=>$payload];
			},
			'args' => [
				'course_id' => ['required' => false, 'type' => 'integer'],
				'redirect'  => ['required' => false, 'type' => 'string'],
				'ttl'       => ['required' => false, 'type' => 'integer'],
			],
		]);
	}

	// ——— Front: QR entry
	public function maybe_handle_qr_entry() {
		if (empty($_GET['qr']) || empty($_GET['t'])) return;

		$token = sanitize_text_field(wp_unslash($_GET['t']));
		$data  = $this->validate_token($token);
		if (!$data) {
			wp_die(__('Érvénytelen vagy lejárt QR link.', 'qr-access'), 403);
		}

		// Persist token across login
		$secure = is_ssl();
		setcookie(self::COOKIE_NAME, $token, [
			'expires'  => (int)$data['exp'],
			'path'     => COOKIEPATH,
			'domain'   => COOKIE_DOMAIN,
			'secure'   => $secure,
			'httponly' => true,
			'samesite' => 'Lax',
		]);

		// Mentünk UTM/campaign adatokat cookie-ba
		if (!headers_sent()) {
			foreach (['utm_source','utm_medium','utm_campaign'] as $utm) {
				if (!empty($_GET[$utm])) {
					setcookie('qr_'.$utm, sanitize_text_field(wp_unslash($_GET[$utm])), (int)$data['exp'], COOKIEPATH, COOKIE_DOMAIN, $secure, true);
				}
			}
		}

		if (is_user_logged_in()) {
			$this->enroll_if_possible(get_current_user_id(), (int)$data['cid']);
			wp_safe_redirect(esc_url_raw($data['redirect']));
			exit;
		}

		// Redirect to login/registration, then back
		$currentUrl = add_query_arg(['qr'=>'1','t'=>rawurlencode($token)], home_url('/'));
		$loginUrl   = wp_login_url($currentUrl);
		wp_safe_redirect($loginUrl);
		exit;
	}

	// ——— After login
	public function maybe_enroll_after_login($user_login, $user) {
		$token = isset($_COOKIE[self::COOKIE_NAME]) ? sanitize_text_field(wp_unslash($_COOKIE[self::COOKIE_NAME])) : '';
		if (!$token) return;
		$data = $this->validate_token($token);
		if (!$data) { $this->clear_cookie(); return; }

		// Mentjük marketing/UTM adatot user meta-ba
		foreach (['utm_source','utm_medium','utm_campaign'] as $utm) {
			if (!empty($_COOKIE['qr_'.$utm])) {
				update_user_meta($user->ID, 'qr_'.$utm, sanitize_text_field(wp_unslash($_COOKIE['qr_'.$utm])));
			}
		}

		$this->enroll_if_possible((int)$user->ID, (int)$data['cid']);
	}

	public function maybe_redirect_after_login($redirect_to, $requested_redirect_to, $user) {
		$token = isset($_COOKIE[self::COOKIE_NAME]) ? sanitize_text_field(wp_unslash($_COOKIE[self::COOKIE_NAME])) : '';
		if (!$token) return $redirect_to;
		$data = $this->validate_token($token);
		$this->clear_cookie();
		return $data && !empty($data['redirect']) ? esc_url_raw($data['redirect']) : $redirect_to;
	}

	// ——— Registration: marketing consent
	public function register_form_marketing_consent() {
		$opts = get_option(self::OPTION_NAME);
		if (empty($opts['require_consent'])) return;
		echo '<p><label><input type="checkbox" name="qr_marketing_consent" value="1" /> '.esc_html__('Hozzájárulok, hogy a megadott elérhetőségeimen marketingcéllal megkeressetek.', 'qr-access').'</label></p>';
	}

	public function validate_marketing_consent($errors, $sanitized_user_login, $user_email) {
		$opts = get_option(self::OPTION_NAME);
		if (empty($opts['require_consent'])) return $errors;
		if (empty($_POST['qr_marketing_consent'])) {
			$errors->add('qr_consent_missing', __('<strong>Hiba</strong>: A marketing hozzájárulás kötelező.', 'qr-access'));
		}
		return $errors;
	}

	public function save_marketing_consent($user_id) {
		if (!empty($_POST['qr_marketing_consent'])) {
			update_user_meta($user_id, 'qr_marketing_consent', 1);
		}
	}

	// ——— Helpers
	private function enroll_if_possible(int $userId, int $courseId): void {
		if ($userId <= 0 || $courseId <= 0) return;
		if (function_exists('ld_update_course_access')) {
			ld_update_course_access($userId, $courseId, false);
		}
	}

	private function sign_token(array $payload): string {
		$body = wp_json_encode($payload, JSON_UNESCAPED_SLASHES);
		$sig  = hash_hmac('sha256', $body, wp_salt('auth'));
		return rtrim(strtr(base64_encode($body.'.'.$sig), '+/', '-_'), '=');
	}

	private function validate_token(string $token) {
		$data = get_transient(self::TRANSIENT_PREF.$token);
		if (!$data || !is_array($data)) return false;
		$decoded = base64_decode(strtr($token, '-_', '+/'));
		if (!$decoded || strpos($decoded, '.') === false) return false;
		list($body, $sig) = explode('.', $decoded, 2);
		$calc = hash_hmac('sha256', $body, wp_salt('auth'));
		if (!hash_equals($calc, $sig)) return false;
		$payload = json_decode($body, true);
		if (!is_array($payload)) return false;
		if (time() > (int)$payload['exp']) return false;
		// összevetjük a transientben lévő alapelemeket
		if ((int)$payload['cid'] !== (int)$data['cid']) return false;
		if ((int)$payload['exp'] !== (int)$data['exp']) return false;
		return $payload;
	}

	private function clear_cookie() {
		setcookie(self::COOKIE_NAME, '', time()-3600, COOKIEPATH, COOKIE_DOMAIN);
	}
}

new QRAccessPlugin();





















