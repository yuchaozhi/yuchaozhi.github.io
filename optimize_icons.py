#!/usr/bin/env python3
"""
网站图标和头像图片优化脚本
专门优化favicon、头像等关键图片的加载速度
"""

import os
import sys
from PIL import Image
import argparse

def optimize_image(input_path, output_path, quality=85, max_size=None):
    """优化单张图片"""
    try:
        with Image.open(input_path) as img:
            # 获取原始尺寸
            original_width, original_height = img.size
            
            # 如果指定了最大尺寸，进行缩放
            if max_size and (original_width > max_size or original_height > max_size):
                if original_width > original_height:
                    new_width = max_size
                    new_height = int(original_height * max_size / original_width)
                else:
                    new_height = max_size
                    new_width = int(original_width * max_size / original_height)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # 处理透明度
            if img.mode in ('RGBA', 'LA', 'P'):
                # 创建白色背景
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # 保存优化后的图片
            img.save(output_path, 'JPEG', quality=quality, optimize=True, progressive=True)
            
            return True
    except Exception as e:
        print(f"✗ 优化失败 {input_path}: {e}")
        return False

def get_file_size(file_path):
    """获取文件大小（KB）"""
    return os.path.getsize(file_path) / 1024

def optimize_icons():
    """优化网站图标和头像"""
    images_dir = "images"
    
    # 需要优化的图片配置
    icon_configs = [
        {
            "input": "cz_profile.jpg",
            "output": "cz_profile_optimized.jpg",
            "quality": 80,
            "max_size": 300,  # 头像不需要太大
            "description": "作者头像"
        },
        {
            "input": "apple-touch-icon.jpg",
            "output": "apple-touch-icon_optimized.jpg",
            "quality": 85,
            "max_size": 180,  # Apple建议的尺寸
            "description": "Apple设备图标"
        },
        {
            "input": "android-chrome-192x192.jpg",
            "output": "android-chrome-192x192_optimized.jpg",
            "quality": 85,
            "max_size": 192,
            "description": "Android图标(192x192)"
        },
        {
            "input": "android-chrome-512x512.jpg",
            "output": "android-chrome-512x512_optimized.jpg",
            "quality": 85,
            "max_size": 512,
            "description": "Android图标(512x512)"
        },
        {
            "input": "favicon-16x16.jpg",
            "output": "favicon-16x16_optimized.jpg",
            "quality": 90,
            "max_size": 16,
            "description": "Favicon 16x16"
        },
        {
            "input": "favicon-32x32.jpg",
            "output": "favicon-32x32_optimized.jpg",
            "quality": 90,
            "max_size": 32,
            "description": "Favicon 32x32"
        }
    ]
    
    print("🎨 网站图标和头像优化工具")
    print("=" * 50)
    
    total_saved = 0
    optimized_count = 0
    
    for config in icon_configs:
        input_path = os.path.join(images_dir, config["input"])
        output_path = os.path.join(images_dir, config["output"])
        
        if not os.path.exists(input_path):
            print(f"⚠️  跳过: {config['input']} (文件不存在)")
            continue
        
        print(f"\n📸 优化 {config['description']}: {config['input']}")
        
        # 优化图片
        if optimize_image(input_path, output_path, config["quality"], config["max_size"]):
            original_size = get_file_size(input_path)
            optimized_size = get_file_size(output_path)
            saved = original_size - optimized_size
            total_saved += saved
            optimized_count += 1
            
            print(f"  ✓ 原始大小: {original_size:.1f}KB")
            print(f"  ✓ 优化后: {optimized_size:.1f}KB")
            print(f"  ✓ 节省空间: {saved:.1f}KB ({saved/original_size*100:.1f}%)")
            
            # 显示优化建议
            if saved > 0:
                print(f"  💡 建议: 将 {config['input']} 替换为 {config['output']}")
        else:
            print(f"  ✗ 优化失败")
    
    print("\n" + "=" * 50)
    print(f"🎉 优化完成!")
    print(f"📊 统计信息:")
    print(f"   - 优化文件数: {optimized_count}")
    print(f"   - 总共节省空间: {total_saved:.1f}KB")
    
    if optimized_count > 0:
        print(f"\n📝 下一步操作:")
        print(f"1. 检查优化后的图片质量")
        print(f"2. 如果满意，将优化后的文件重命名为原文件名")
        print(f"3. 更新网站配置以使用优化后的图片")

def create_webp_versions():
    """创建WebP版本的图标"""
    images_dir = "images"
    
    # 需要转换为WebP的图片
    webp_candidates = [
        "cz_profile.jpg",
        "apple-touch-icon.jpg",
        "android-chrome-192x192.jpg",
        "android-chrome-512x512.jpg"
    ]
    
    print("\n🔄 创建WebP版本")
    print("-" * 30)
    
    for filename in webp_candidates:
        input_path = os.path.join(images_dir, filename)
        webp_path = os.path.join(images_dir, filename.replace('.jpg', '.webp'))
        
        if not os.path.exists(input_path):
            continue
        
        try:
            with Image.open(input_path) as img:
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                img.save(webp_path, 'WEBP', quality=85, optimize=True)
                
                original_size = get_file_size(input_path)
                webp_size = get_file_size(webp_path)
                saved = original_size - webp_size
                
                print(f"✓ {filename} -> {filename.replace('.jpg', '.webp')}")
                print(f"  节省: {saved:.1f}KB ({saved/original_size*100:.1f}%)")
                
        except Exception as e:
            print(f"✗ {filename}: {e}")

def main():
    parser = argparse.ArgumentParser(description='网站图标和头像优化工具')
    parser.add_argument('--webp', action='store_true', help='同时创建WebP版本')
    
    args = parser.parse_args()
    
    # 优化图标
    optimize_icons()
    
    # 创建WebP版本
    if args.webp:
        create_webp_versions()
    
    print(f"\n✨ 优化完成！建议在浏览器中测试优化效果。")

if __name__ == "__main__":
    main() 