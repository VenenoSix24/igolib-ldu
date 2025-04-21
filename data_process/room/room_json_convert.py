import json
import csv
import os

def extract_library_mappings(input_filepath, output_filepath, output_format='json'):
    """
    Reads a specific JSON structure, navigates to the 'libs' array under
    'data.userAuth.reserve', extracts lib_id -> lib_name mappings,
    and exports them to an output file.

    Args:
        input_filepath (str): Path to the input JSON file.
        output_filepath (str): Path where the output file will be saved (base name, extension added by format).
        output_format (str): Format for the output file ('json', 'csv', 'txt').

    Returns:
        bool: True if successful, False otherwise.
    """
    print(f"开始处理图书馆信息文件: {input_filepath}")
    mappings = {} # Dictionary to store lib_id: lib_name
    processed_count = 0
    skipped_count = 0
    libs_encountered = 0

    # --- 1. Read and Parse Input JSON Object ---
    try:
        if not os.path.exists(input_filepath):
             print(f"错误: 输入文件未找到 {input_filepath}")
             return False

        with open(input_filepath, 'r', encoding='utf-8') as f:
            try:
                full_data = json.load(f)
            except json.JSONDecodeError as e:
                print(f"\n错误: 文件 {input_filepath} 包含无效的 JSON 数据: {e}")
                return False

            if not isinstance(full_data, dict):
                print(f"错误: 文件 {input_filepath} 的顶层结构不是一个 JSON 对象。")
                return False

            # --- Navigate to the 'libs' array ---
            # Path: data -> userAuth -> reserve -> libs
            libs_list = full_data.get('data', {}).get('userAuth', {}).get('reserve', {}).get('libs')

            if not isinstance(libs_list, list):
                print(f"错误: 在 JSON 结构中未找到 'data.userAuth.reserve.libs' 或其值不是列表。")
                return False

            if not libs_list:
                print("警告: 'data.userAuth.reserve.libs' 列表为空，没有可处理的图书馆信息。")
                # Proceed to potentially write an empty file

            libs_encountered = len(libs_list)
            print(f"找到 {libs_encountered} 个图书馆条目，开始提取 ID 和名称...")

            # --- Iterate through each library entry ---
            for index, lib_data in enumerate(libs_list):
                if not isinstance(lib_data, dict):
                    print(f"警告: 'libs' 列表中的第 {index + 1} 个元素不是字典，已跳过。")
                    skipped_count += 1
                    continue

                lib_id = lib_data.get('lib_id')
                lib_name = lib_data.get('lib_name')

                # --- Validation ---
                # Ensure lib_id is present (and ideally a number, though we store as key)
                # Ensure lib_name is present and a non-empty string
                if lib_id is not None and lib_name and isinstance(lib_name, str):
                    # Check for duplicate lib_ids
                    if lib_id in mappings:
                        print(f"警告: 图书馆 ID '{lib_id}' 重复出现 (之前名称: '{mappings[lib_id]}', 当前名称: '{lib_name}'). 已覆盖。")
                    mappings[lib_id] = lib_name
                    processed_count += 1
                else:
                    skipped_count += 1
                    print(f"警告: 第 {index + 1} 个图书馆条目缺少有效的 'lib_id' 或 'lib_name'，已跳过。 (ID: {lib_id}, Name: {lib_name})")

    except FileNotFoundError:
        print(f"错误: 输入文件未找到 {input_filepath}")
        return False
    except Exception as e:
        print(f"读取或解析文件 {input_filepath} 时发生意外错误: {e}")
        # import traceback
        # traceback.print_exc() # Uncomment for detailed error stack trace
        return False

    # --- Summary ---
    print(f"\n--- 图书馆信息提取总结 ---")
    print(f"  遇到的图书馆条目总数: {libs_encountered}")
    print(f"  成功提取的 ID-名称 映射数量: {processed_count}")
    print(f"  跳过的无效/不完整条目数量: {skipped_count}")
    print(f"共提取 {len(mappings)} 个唯一的 图书馆ID -> 名称 映射。")

    if not mappings and processed_count == 0:
         print("警告: 未能从输入文件中提取任何有效的 图书馆ID-名称 映射。")
         # return False # Optional: stop if nothing found

    # --- 2. Export Mappings ---
    # Construct the full output path based on the base name and format
    output_base_path = output_filepath # Use the provided base name
    output_dir = os.path.dirname(output_base_path)
    full_output_path = f"{output_base_path}.{output_format}"

    print(f"\n准备将提取的 {len(mappings)} 个映射导出到: {full_output_path} (格式: {output_format})")
    try:
        # Ensure the output directory exists
        if output_dir and not os.path.exists(output_dir):
             print(f"创建输出目录: {output_dir}")
             os.makedirs(output_dir)

        with open(full_output_path, 'w', encoding='utf-8', newline='') as f:
            if output_format == 'json':
                # Export as JSON object {lib_id: lib_name, ...}
                # Keys in JSON objects are always strings, json.dump handles conversion
                json.dump(mappings, f, ensure_ascii=False, indent=4, sort_keys=True) # Sort by ID for readability
            elif output_format == 'csv':
                # Export as CSV
                writer = csv.writer(f)
                writer.writerow(['library_id', 'library_name']) # Header row
                # Sort by ID before writing for consistent output
                for lib_id in sorted(mappings.keys()):
                    writer.writerow([lib_id, mappings[lib_id]])
            elif output_format == 'txt':
                 # Export as simple Text "ID : Name"
                 # Sort by ID before writing
                 for lib_id in sorted(mappings.keys()):
                     f.write(f"{lib_id} : {mappings[lib_id]}\n")
            else:
                print(f"错误: 不支持的输出格式 '{output_format}'. 支持 'json', 'csv', 'txt'.")
                return False

        print(f"结果已成功导出到: {full_output_path}")
        return True

    except IOError as e:
        print(f"错误: 无法写入输出文件 {full_output_path}. 错误信息: {e}")
        return False
    except Exception as e:
        print(f"导出结果时发生意外错误: {e}")
        return False

# --- 使用示例 ---

# 1. 指定你的输入 JSON 文件名
input_library_json_file = 'room_data.json' # <--- 修改这里：包含图书馆列表的 JSON 文件

# 2. 指定输出文件名的 *基础部分* (不含扩展名) 和路径
#    例如 'library_mappings' 会生成 library_mappings.json, library_mappings.csv 等
output_file_base = 'output/room_mappings' # <--- 修改这里：输出文件名的基础
#    可以包含路径，例如 'output/library_mappings'
# output_file_base = os.path.join('output_files', 'library_mappings')

# 3. (可选) 创建示例输入文件用于测试
if not os.path.exists(input_library_json_file):
    print(f"警告: 输入文件 {input_library_json_file} 未找到。将创建一个示例文件。")
    sample_library_data = """
{
  "data": {
    "userAuth": {
      "reserve": {
        "libs": [
          {"lib_id": 525,"lib_floor": "2楼","is_open": true,"lib_name": "现刊借阅室201","lib_type": 0,"lib_group_id": 0,"lib_comment": "","lib_rt": {"seats_total": 292,"seats_used": 105,"seats_booking": 1,"seats_has": 186}},
          {"lib_id": 563,"lib_floor": "2楼","is_open": true,"lib_name": "过刊阅览室202","lib_type": 0,"lib_group_id": 0,"lib_comment": "","lib_rt": {"seats_total": 211,"seats_used": 71,"seats_booking": 0,"seats_has": 140}},
          {"lib_id": 20060,"lib_floor": "6楼","is_open": true,"lib_name": "602自习室","lib_type": 0,"lib_group_id": 0,"lib_comment": "","lib_rt": {"seats_total": 280,"seats_used": 219,"seats_booking": 1,"seats_has": 60}},
          {"lib_id": 124452,"lib_floor": "1楼","is_open": true,"lib_name": "一楼大厅","lib_type": 0,"lib_group_id": 0,"lib_comment": "","lib_rt": {"seats_total": 96,"seats_used": 30,"seats_booking": 0,"seats_has": 66}},
          {"lib_id": 525,"lib_floor": "2楼","is_open": true,"lib_name": "现刊室(重复ID)","lib_type": 0},
          {"lib_id": 999,"lib_floor": "未知","is_open": false,"lib_name": ""}
        ],
        "libGroups": [],
        "reserve": null
      },
      "record": {"libs": []},
      "rule": {"signRule": ""}
    }
  }
}
"""
    try:
        output_basedir = os.path.dirname(input_library_json_file)
        if output_basedir and not os.path.exists(output_basedir):
             os.makedirs(output_basedir)
        with open(input_library_json_file, 'w', encoding='utf-8') as f:
            f.write(sample_library_data.strip())
        print(f"已创建示例文件: {input_library_json_file}")
    except IOError as e:
         print(f"无法创建示例输入文件: {e}")


# 4. 调用函数处理文件并导出为不同格式
print("-" * 30)
success_json = extract_library_mappings(input_library_json_file, output_file_base, output_format='json')
print("-" * 30)
success_csv = extract_library_mappings(input_library_json_file, output_file_base, output_format='csv')
print("-" * 30)
success_txt = extract_library_mappings(input_library_json_file, output_file_base, output_format='txt')
print("-" * 30)

# 5. 检查结果
print("--- 导出状态 ---")
if success_json: print(f"JSON 导出完成。查看文件: {output_file_base}.json")
else: print("JSON 导出操作失败或未执行。")
if success_csv: print(f"CSV 导出完成。查看文件: {output_file_base}.csv")
else: print("CSV 导出操作失败或未执行。")
if success_txt: print(f"TXT 导出完成。查看文件: {output_file_base}.txt")
else: print("TXT 导出操作失败或未执行。")
if not success_json or not success_csv or not success_txt:
    print("\n警告：至少有一个导出步骤失败。请检查上面的错误信息。")