import logging
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.config import get_settings

logger = logging.getLogger(__name__)


def _build_email_html(topic_data: dict) -> str:
    """构建热点通知邮件 HTML"""
    title = topic_data.get("title", "")
    summary = topic_data.get("summary", "")
    url = topic_data.get("source_url", "#")
    source = topic_data.get("source_name", "")
    heat = topic_data.get("heat_score", 0)
    tags = topic_data.get("tags", [])
    trigger = topic_data.get("trigger_keyword", "")

    tags_html = "".join(
        f'<span style="background:#00d4ff22;color:#00d4ff;padding:2px 8px;border-radius:4px;margin-right:4px;font-size:12px">{t}</span>'
        for t in tags
    )
    trigger_line = f"<p style='color:#aaa;font-size:13px'>触发关键词：<b style='color:#00d4ff'>{trigger}</b></p>" if trigger else ""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0a0a0f;color:#e0e0e0;font-family:Inter,sans-serif;padding:32px">
  <div style="max-width:600px;margin:0 auto;background:#12121a;border:1px solid #00d4ff33;border-radius:12px;padding:24px">
    <div style="display:flex;align-items:center;margin-bottom:16px">
      <span style="font-size:24px;margin-right:8px">🔥</span>
      <h1 style="color:#00d4ff;font-size:20px;margin:0">hot-monitor 热点通知</h1>
    </div>
    <div style="background:#ffffff0a;border-left:3px solid #00d4ff;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:16px">
      <p style="margin:0 0 4px;font-size:16px;font-weight:600">{title}</p>
      <p style="margin:0;color:#aaa;font-size:13px">来源：{source}</p>
    </div>
    <p style="font-size:14px;line-height:1.7;color:#ccc">{summary}</p>
    {trigger_line}
    <div style="margin:12px 0">{tags_html}</div>
    <div style="display:flex;align-items:center;gap:8px;margin:16px 0">
      <span style="color:#aaa;font-size:13px">热度评分：</span>
      <span style="color:#ff6b35;font-size:18px;font-weight:700">{heat}/10</span>
    </div>
    <a href="{url}" style="display:inline-block;background:#00d4ff;color:#0a0a0f;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">查看原文 →</a>
    <hr style="border:none;border-top:1px solid #ffffff15;margin:24px 0">
    <p style="color:#555;font-size:12px;margin:0">由 hot-monitor 自动发送 | <a href="http://localhost:8000" style="color:#00d4ff55">打开 Dashboard</a></p>
  </div>
</body>
</html>"""


async def send_notification_email(topic_data: dict) -> bool:
    """发送热点通知邮件，返回是否成功"""
    settings = get_settings()
    if not settings.SMTP_USER or settings.SMTP_USER == "your_email@gmail.com":
        logger.warning("SMTP 未配置，跳过邮件发送")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🔥 热点发现：{topic_data.get('title', '')[:50]}"
        msg["From"] = settings.SMTP_USER
        msg["To"] = settings.NOTIFY_EMAIL or settings.SMTP_USER

        html_content = _build_email_html(topic_data)
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
            timeout=30,
        )
        logger.info(f"邮件发送成功 → {msg['To']}: {topic_data.get('title', '')[:50]}")
        return True
    except Exception as e:
        logger.error(f"邮件发送失败: {e}")
        return False


async def send_test_email() -> bool:
    """发送测试邮件"""
    return await send_notification_email({
        "title": "✅ hot-monitor 通知测试",
        "summary": "如果你看到此邮件，说明邮件通知配置正确！",
        "source_url": "http://localhost:8000",
        "source_name": "hot-monitor",
        "heat_score": 10,
        "tags": ["测试", "通知"],
        "trigger_keyword": "",
    })
