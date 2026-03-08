#!/usr/bin/env python3
"""Generate annotated screenshots for ultrademo feature map."""

from PIL import Image, ImageDraw, ImageFont
import os

SRC = "/Users/wp/w/uw3/ultrademopng"
DST = "/Users/wp/w/uw3/spec/ultrademo-img"

os.makedirs(DST, exist_ok=True)

def draw_red_box(img, box, label=None, width=6):
    """Draw a red rectangle on the image. box = (x1, y1, x2, y2)."""
    draw = ImageDraw.Draw(img)
    for i in range(width):
        draw.rectangle(
            [box[0]-i, box[1]-i, box[2]+i, box[3]+i],
            outline="red"
        )
    if label:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
        except:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        lx, ly = box[0], box[1] - th - 16
        if ly < 0:
            ly = box[3] + 6
        draw.rectangle([lx, ly, lx + tw + 12, ly + th + 10], fill="red")
        draw.text((lx + 6, ly + 4), label, fill="white", font=font)
    return img


def annotate(filename, output_name, annotations):
    """Load image, apply annotations, save."""
    img = Image.open(os.path.join(SRC, filename))
    for ann in annotations:
        img = draw_red_box(img, ann["box"], ann.get("label"), ann.get("width", 6))
    img.save(os.path.join(DST, output_name))
    print(f"  Saved {output_name} ({img.size[0]}x{img.size[1]})")


print("--- Generating annotated screenshots ---\n")

# 1. Home page dark - sidebar, ability cards, composer
# 首页@2x.png: 3158x1936
annotate("首页@2x.png", "01-home-full.png", [
    {"box": (0, 0, 416, 1936), "label": "Left Sidebar"},
    {"box": (900, 620, 2700, 1120), "label": "Ability Cards"},
    {"box": (900, 1180, 2700, 1500), "label": "Composer Input"},
])

# 2. Home page light
# 浅色@2x.png: 3414x2130
annotate("浅色@2x.png", "02-home-light.png", [
    {"box": (0, 0, 420, 2130), "label": "Left Sidebar"},
    {"box": (960, 700, 2800, 1200), "label": "Ability Cards"},
    {"box": (960, 1260, 2800, 1560), "label": "Composer Input"},
])

# 3. Prompt recommendations (浅色3 shows prompts expanded)
# 浅色3@2x.png: 3414x2130
annotate("浅色3@2x.png", "03-prompt-recommendations.png", [
    {"box": (960, 520, 2800, 1080), "label": "Ability Cards + Prompts"},
    {"box": (960, 1080, 2800, 1780), "label": "Recommended Prompts"},
])

# 3b. Dark theme prompt recommendations
# 点击推荐@2x.png: 3158x1936
annotate("点击推荐@2x.png", "03b-prompt-recommendations-dark.png", [
    {"box": (900, 440, 2700, 1400), "label": "Recommended Prompts"},
])

# 4. Task execution detail
# 任务执行详情@2x.png: 3158x1986
annotate("任务执行详情@2x.png", "04-task-detail.png", [
    {"box": (420, 120, 2160, 1500), "label": "Chat Area"},
    {"box": (2160, 120, 3158, 1100), "label": "Right Detail Panel"},
    {"box": (420, 1530, 2160, 1710), "label": "Composer"},
])

# 5. Task detail with artifact preview
# 任务执行详情-产物preview@2x.png: 3160x1986
annotate("任务执行详情-产物preview@2x.png", "05-artifact-preview.png", [
    {"box": (420, 120, 1400, 1500), "label": "Chat Area"},
    {"box": (1400, 120, 2300, 1500), "label": "Artifact Preview"},
    {"box": (2300, 120, 3160, 1500), "label": "Right Detail Panel"},
])

# 6. Task context menu
# 任务操作@2x.png: 3158x1986
annotate("任务操作@2x.png", "06-task-operations.png", [
    {"box": (180, 1050, 510, 1250), "label": "Context Menu"},
])

# 7. Model selector
# 模型选择@2x.png: 3158x2480
annotate("模型选择@2x.png", "07-model-selector.png", [
    {"box": (1530, 860, 2250, 1560), "label": "Model Selector"},
])

# 8. + menu (MCP, Skills, Plugins)
# 对话框配置@2x.png: 3158x1954
annotate("对话框配置@2x.png", "08-add-menu.png", [
    {"box": (1240, 1120, 1800, 1560), "label": "+ Menu"},
    {"box": (1800, 1180, 2440, 1560), "label": "MCP Services Toggle"},
])

# 9. Settings - General (profile + notifications)
# 设置-通用1@2x.png: 3414x2130
annotate("设置-通用1@2x.png", "09-settings-general1.png", [
    {"box": (440, 80, 960, 400), "label": "Settings Nav"},
    {"box": (960, 80, 3200, 800), "label": "Personal Profile"},
    {"box": (960, 800, 3200, 1400), "label": "Notification Settings"},
])

# 10. Settings - General (theme, font)
# 设置-通用2@2x.png: 3158x1936
annotate("设置-通用2@2x.png", "10-settings-general2.png", [
    {"box": (960, 640, 3000, 1060), "label": "Theme & Font"},
])

# 11. Settings - Privacy
# 设置-隐私@2x.png: 3158x1986
annotate("设置-隐私@2x.png", "11-settings-privacy.png", [
    {"box": (960, 80, 3000, 400), "label": "Data Protection"},
    {"box": (960, 400, 3000, 840), "label": "Data Management"},
    {"box": (960, 840, 3000, 1200), "label": "Data Cleanup"},
])

# 12. Settings - Capabilities
# 设置-能力配置@2x.png: 3158x1986
annotate("设置-能力配置@2x.png", "12-settings-capabilities.png", [
    {"box": (960, 80, 3000, 560), "label": "Memory Management"},
    {"box": (960, 560, 3000, 1100), "label": "Tool Access Mode"},
])

# 13. Model config dialog
# 模型配置@2x.png: 3168x1986
annotate("模型配置@2x.png", "13-model-config.png", [
    {"box": (880, 350, 2100, 1200), "label": "Model Provider Config"},
])

# 14. Custom provider dialog
# 模型配置-供应商@2x.png: 3168x1986
annotate("模型配置-供应商@2x.png", "14-custom-provider.png", [
    {"box": (880, 240, 2100, 1500), "label": "Custom Provider Form"},
])

# 15. Workspace config dialog
# 工作目录配置@2x.png: 3168x1986
annotate("工作目录配置@2x.png", "15-workspace-config.png", [
    {"box": (880, 480, 2100, 1100), "label": "Workspace Directory List"},
])

# 16. Workspace env config
# 工作目录配置-环境配置@2x.png: 3424x2130
annotate("工作目录配置-环境配置@2x.png", "16-workspace-env.png", [
    {"box": (900, 530, 2100, 1100), "label": "Runtime Environment"},
])

# 17. Channels config
# 消息通道配置@2x.png: 3168x1986
annotate("消息通道配置@2x.png", "17-channels-config.png", [
    {"box": (900, 420, 2100, 1200), "label": "Channel Configuration"},
])

# 18. Remote service
# 远程服务配置@2x.png: 3168x1986
annotate("远程服务配置@2x.png", "18-remote-service.png", [
    {"box": (900, 450, 2100, 1200), "label": "Remote Service Connection"},
])

# 19. About dialog
# 关于我们@2x.png: 3168x1986
annotate("关于我们@2x.png", "19-about.png", [
    {"box": (900, 450, 2100, 1200), "label": "About Dialog"},
])

# 20. Customization page
# 定制化（自定义）@2x.png: 4096x2130
annotate("定制化（自定义）@2x.png", "20-customization.png", [
    {"box": (0, 0, 510, 2130), "label": "Custom Nav"},
    {"box": (510, 0, 1440, 2130), "label": "Skill List"},
    {"box": (1440, 0, 4096, 2130), "label": "Skill Detail"},
])

print("\nDone!")
