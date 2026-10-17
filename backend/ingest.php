<?php
// HTTP ingestion never runs schema migrations, even with a misconfigured private config.
if (!defined('DB_AUTO_MIGRATE')) { define('DB_AUTO_MIGRATE',false); }
require_once __DIR__.'/bootstrap.php';
if (!defined('CLOUDHUB_CORE_ENABLED') || CLOUDHUB_CORE_ENABLED!==true || !defined('CLOUDHUB_INGEST_ENABLED') || CLOUDHUB_INGEST_ENABLED!==true) { wp_json_error(404,'Not found'); }
if (($_SERVER['REQUEST_METHOD']??'')!=='POST') { header('Allow: POST'); wp_json_error(405,'POST required'); }
if (strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json') { wp_json_error(415,'JSON required'); }
if ((int)($_SERVER['CONTENT_LENGTH']??0)>65536) { wp_json_error(413,'Event too large'); }
$body=file_get_contents('php://input',false,null,0,65537);
if ($body===false || strlen($body)>65536) { wp_json_error(413,'Event too large'); }
require_once __DIR__.'/class/CloudHubIngestAuth.php';
try {
    $server=CloudHubIngestAuth::verify(['server'=>$_SERVER['HTTP_X_CLOUDHUB_SERVER']??'', 'timestamp'=>$_SERVER['HTTP_X_CLOUDHUB_TIMESTAMP']??'', 'signature'=>$_SERVER['HTTP_X_CLOUDHUB_SIGNATURE']??''],$body,defined('CLOUDHUB_INGEST_KEYS')?CLOUDHUB_INGEST_KEYS:[],time());
} catch (InvalidArgumentException $e) { wp_json_error(401,'Server authentication required'); }
// No Steam session, cookies, roles or client-supplied reward amounts authorize ingestion.
require_once __DIR__.'/class/CloudHubRounds.php';
require_once __DIR__.'/class/Database.php';
try {
    $result=(new CloudHubRounds(Database::getInstance()->getConnection()))->accept($server,$body);
    header('Content-Type: application/json'); echo json_encode($result,JSON_THROW_ON_ERROR);
} catch (CloudHubEventConflict $e) { wp_json_error(409,'Event or round identity conflict'); }
catch (InvalidArgumentException|JsonException $e) { wp_json_error(422,'Invalid round event'); }
